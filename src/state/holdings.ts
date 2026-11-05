import { useSyncExternalStore } from 'react';
import { orderHistoryStore, tradingSessionId } from './orderHistory';
import { HOLDINGS, SYMBOLS } from '../data/holdings';
import { createTradingStore } from '../domain/trading';
import { getQuotesSnapshot, subscribeToPriceTicks } from './market';

// Seed data is read once. All screens consume this shared, mutable-session store.
export const tradingStore = createTradingStore(
  HOLDINGS,
  (symbol) => getQuotesSnapshot()[symbol],
  SYMBOLS,
  Date.now,
  orderHistoryStore.record,
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
  return `local-${tradingSessionId}-${++requestCounter}`;
}

// App owns this subscription, so pending orders match even off the detail screen.
export function startLimitOrderMatching(): () => void {
  return subscribeToPriceTicks((tick) =>
    tradingStore.processPriceTick(tick.symbol, tick.price),
  );
}

export function useLimitOrders() {
  return useSyncExternalStore(
    tradingStore.subscribeOrders,
    tradingStore.getOrdersSnapshot,
  );
}

function subscribeToAvailability(listener: () => void): () => void {
  const stopHoldings = tradingStore.subscribe(listener);
  const stopOrders = tradingStore.subscribeOrders(listener);
  return () => {
    stopHoldings();
    stopOrders();
  };
}

export function useAvailableShares(symbol: string): number {
  // A primitive snapshot avoids rerendering controls when another stock trades.
  return useSyncExternalStore(subscribeToAvailability, () =>
    tradingStore.availableToSell(symbol),
  );
}
