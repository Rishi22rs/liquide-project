import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createTickHistory } from '../../domain/tickHistory';
import { subscribeToPriceTicks } from '../../state/market';

export function useTickHistory(symbol: string) {
  const history = useMemo(() => createTickHistory(symbol), [symbol]);
  const points = useSyncExternalStore(history.subscribe, history.getSnapshot);

  // Navigating away releases the listener and the screen's session history.
  useEffect(() => subscribeToPriceTicks(history.append), [history]);
  return points;
}
