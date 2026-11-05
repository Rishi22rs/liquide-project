import { useSyncExternalStore } from 'react';
import { HOLDINGS, SYMBOLS } from '../data/holdings';
import { createTradingStore } from '../domain/trading';
import { getQuotesSnapshot } from './market';

// Seed data is read once. All screens consume this shared, mutable-session store.
export const tradingStore = createTradingStore(
  HOLDINGS,
  (symbol) => getQuotesSnapshot()[symbol],
  SYMBOLS,
);

export function useHoldings() {
  return useSyncExternalStore(tradingStore.subscribe, tradingStore.getSnapshot);
}

export function useHolding(symbol: string) {
  return useSyncExternalStore(tradingStore.subscribe, () =>
    tradingStore.getSnapshot().find((item) => item.symbol === symbol),
  );
}

let requestCounter = 0;
export function createTradeRequestId(): string {
  return `local-${Date.now()}-${++requestCounter}`;
}
