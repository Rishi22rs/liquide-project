import { useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { rippleGeometry } from '../domain/themeRipple';
import { themePreference } from '../state/themePreference';
import { ThemeTransitionContext, type ThemeAnchor } from './ThemeTransitionContext';

/** Browser snapshots use the View Transition API; native uses an app-view
 * capture. Both reveal the new interface from the same header-switch origin. */
export function ThemeRippleProvider({ children }: { children: ReactNode }) {
  const locked = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    mounted.current = true;
    const style = document.createElement('style');
    style.textContent =
      '::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}::view-transition-old(root){z-index:1}::view-transition-new(root){z-index:2}';
    document.head.appendChild(style);
    return () => {
      mounted.current = false;
      style.remove();
    };
  }, []);
  async function toggleAt(anchor: ThemeAnchor) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    const target = themePreference.getSnapshot() === 'dark' ? 'light' : 'dark';
    let changed = false;
    try {
      if (
        !document.startViewTransition ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !anchor.current
      ) {
        themePreference.select(target);
        return;
      }
      const button = await new Promise<{
        x: number;
        y: number;
        width: number;
        height: number;
      }>((resolve) =>
        anchor.current!.measureInWindow((x, y, width, height) =>
          resolve({ x, y, width, height }),
        ),
      );
      const { x, y, radius } = rippleGeometry(
        { x: button.x + button.width / 2, y: button.y + button.height / 2 },
        window.innerWidth,
        window.innerHeight,
      );
      const transition = document.startViewTransition(() => {
        flushSync(() => themePreference.select(target));
        changed = true;
      });
      await transition.ready;
      await document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 520,
          easing: 'cubic-bezier(.22,1,.36,1)',
          pseudoElement: '::view-transition-new(root)',
        },
      ).finished;
      await transition.finished;
    } catch {
      if (!changed && mounted.current) themePreference.select(target);
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <ThemeTransitionContext.Provider value={{ busy, toggleAt }}>
      {children}
    </ThemeTransitionContext.Provider>
  );
}
