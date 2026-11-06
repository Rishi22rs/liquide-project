export type ThemeMode = 'light' | 'dark';
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
const KEY = 'liquide.theme.v1';

/** Theme is shared across screens. A tap wins over a slow startup read; writes
 * stay ordered so rapid toggles cannot save an older choice last. */
export function createThemePreference(storage: Storage) {
  let mode: ThemeMode = 'dark';
  let revision = 0;
  let loading: Promise<void> | undefined;
  let queue = Promise.resolve();
  const listeners = new Set<() => void>();
  function publish(next: ThemeMode) {
    if (mode === next) return;
    mode = next;
    listeners.forEach((listener) => listener());
  }
  function select(next: ThemeMode) {
    revision++;
    publish(next);
    queue = queue.then(() => storage.setItem(KEY, next)).catch(() => {});
  }
  return {
    getSnapshot: () => mode,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load() {
      if (revision > 0) return Promise.resolve();
      loading ??= (async () => {
        const beforeRead = revision;
        try {
          const saved = await storage.getItem(KEY);
          if (revision === beforeRead && (saved === 'light' || saved === 'dark'))
            publish(saved);
        } catch {
          /* Storage is optional for appearance; the in-memory switch still works. */
        }
      })();
      return loading;
    },
    toggle() {
      select(mode === 'dark' ? 'light' : 'dark');
    },
    waitForSaves: () => queue,
  };
}
