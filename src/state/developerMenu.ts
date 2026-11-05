const listeners = new Set<() => void>();

/** The in-app DEV button and native developer menu open the same panel. */
export function openSimulatorControls(): void {
  if (__DEV__) listeners.forEach((listener) => listener());
}
export function subscribeToSimulatorMenu(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
