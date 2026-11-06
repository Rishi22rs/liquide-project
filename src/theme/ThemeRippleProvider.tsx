import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Image as SvgImage, Mask, Rect } from 'react-native-svg';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { rippleGeometry } from '../domain/themeRipple';
import type { ThemeMode } from '../domain/themePreference';
import { themePreference } from '../state/themePreference';
import {
  ThemeTransitionContext,
  type ThemeAnchor,
  type ThemeView,
} from './ThemeTransitionContext';
import { useTheme } from './theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
type Snapshot = {
  uri: string;
  x: number;
  y: number;
  radius: number;
  width: number;
  height: number;
  target: ThemeMode;
  token: number;
};

/** Freeze only the old pixels. Live prices continue underneath while a growing
 * circular hole reveals the real new-themed interface, not a flat color splash. */
export function ThemeRippleProvider({ children }: { children: ReactNode }) {
  const root = useRef<ThemeView>(null);
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const current = useRef<Snapshot | undefined>(undefined);
  const started = useRef(false);
  const token = useRef(0);
  const loadTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const animation = useRef<Animated.CompositeAnimation | undefined>(undefined);
  const radius = useRef(new Animated.Value(0)).current;
  const maskId = useId().replace(/:/g, '');

  function finish() {
    clearTimeout(loadTimeout.current);
    const previous = current.current;
    current.current = undefined;
    locked.current = false;
    if (mounted.current) {
      setSnapshot(undefined);
      setBusy(false);
    }
    if (previous) releaseCapture(previous.uri);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(loadTimeout.current);
      animation.current?.stop();
      if (current.current) releaseCapture(current.current.uri);
      current.current = undefined;
    };
  }, []);

  function reveal(ready: Snapshot) {
    if (!mounted.current || current.current?.token !== ready.token || started.current)
      return;
    started.current = true;
    clearTimeout(loadTimeout.current);
    themePreference.select(ready.target);
    // The old screenshot is already decoded before the palette changes. Wait a
    // frame for the new React surfaces to commit, then uncover them together.
    requestAnimationFrame(() => {
      if (!mounted.current || current.current?.token !== ready.token) return;
      animation.current = Animated.timing(radius, {
        toValue: ready.radius,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
        isInteraction: false,
      });
      animation.current.start(finish);
    });
  }

  async function toggleAt(anchor: ThemeAnchor) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    const target: ThemeMode = themePreference.getSnapshot() === 'dark' ? 'light' : 'dark';
    let captured: string | undefined;
    let abandoned = false;
    loadTimeout.current = setTimeout(() => {
      abandoned = true;
      if (mounted.current) themePreference.select(target);
      finish();
    }, 2500);
    try {
      const reduced = await AccessibilityInfo.isReduceMotionEnabled().catch(() => true);
      if (abandoned || !mounted.current) return;
      if (reduced || !root.current || !anchor.current) {
        if (mounted.current) themePreference.select(target);
        finish();
        return;
      }
      const frame = await measure(root.current);
      const button = await measure(anchor.current);
      if (abandoned || !mounted.current) return;
      if (!frame.width || !frame.height) {
        if (mounted.current) themePreference.select(target);
        finish();
        return;
      }
      const geometry = rippleGeometry(
        {
          x: button.x - frame.x + button.width / 2,
          y: button.y - frame.y + button.height / 2,
        },
        frame.width,
        frame.height,
      );
      captured = await captureRef(root, { format: 'png', result: 'tmpfile', quality: 1 });
      if (abandoned || !mounted.current) {
        releaseCapture(captured);
        return;
      }
      const next: Snapshot = {
        ...geometry,
        width: frame.width,
        height: frame.height,
        uri: captured,
        target,
        token: ++token.current,
      };
      radius.setValue(0);
      started.current = false;
      current.current = next;
      setSnapshot(next);
      // A decoding failure must never strand the app behind an old screenshot.
      clearTimeout(loadTimeout.current);
      loadTimeout.current = setTimeout(() => {
        if (current.current?.token === next.token && !started.current) {
          themePreference.select(target);
          finish();
        }
      }, 1500);
    } catch {
      if (abandoned) {
        if (captured) releaseCapture(captured);
        return;
      }
      if (captured && current.current?.uri !== captured) releaseCapture(captured);
      if (mounted.current) themePreference.select(target);
      finish();
    }
  }
  return (
    <ThemeTransitionContext.Provider value={{ busy, toggleAt }}>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <View
          ref={root}
          collapsable={false}
          pointerEvents={busy ? 'none' : 'auto'}
          style={styles.root}
        >
          {children}
        </View>
        {snapshot && (
          <View
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={StyleSheet.absoluteFill}
          >
            <Svg width={snapshot.width} height={snapshot.height}>
              <Defs>
                <Mask
                  id={maskId}
                  x={0}
                  y={0}
                  width={snapshot.width}
                  height={snapshot.height}
                  maskUnits="userSpaceOnUse"
                  maskType="luminance"
                >
                  <Rect width={snapshot.width} height={snapshot.height} fill="white" />
                  <AnimatedCircle
                    cx={snapshot.x}
                    cy={snapshot.y}
                    r={radius}
                    fill="black"
                  />
                </Mask>
              </Defs>
              <SvgImage
                href={{ uri: snapshot.uri }}
                x={0}
                y={0}
                width={snapshot.width}
                height={snapshot.height}
                preserveAspectRatio="none"
                mask={`url(#${maskId})`}
                onLoad={() => reveal(snapshot)}
              />
            </Svg>
          </View>
        )}
      </View>
    </ThemeTransitionContext.Provider>
  );
}
function measure(
  view: ThemeView,
): Promise<{ x: number; y: number; width: number; height: number }> {
  return new Promise((resolve) =>
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height })),
  );
}
const styles = StyleSheet.create({ root: { flex: 1 } });
