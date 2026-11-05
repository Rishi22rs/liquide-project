import { useSyncExternalStore } from 'react';
import type { PriceTick } from '../domain/tickHistory';
import { fetchQuotes } from '../data/api';
import { mergeTick, type Quote, type Tick } from '../domain/portfolio';
import { createReconnectingFeed } from '../feed/reconnectingFeed';
import { createSimulator } from '../feed/simulator';

type MarketStatus = Readonly<{
  loading: boolean;
  error?: string;
  reconnecting?: boolean;
  paused: boolean;
}>;

const PAUSED_AFTER_MS = 2_000;
const HEALTH_CHECK_INTERVAL_MS = 500;
const listeners = new Set<() => void>();
const priceTickListeners = new Set<(tick: PriceTick) => void>();

// Quotes and status have separate snapshot identities. A price tick should not
// render components that only care about connection/loading status.
let quotes: Readonly<Record<string, Quote>> = {};
let status: MarketStatus = { loading: true, paused: false };
let healthCheckTimer: ReturnType<typeof setInterval> | undefined;
let lastAcceptedTickAt = 0;
const connection = createReconnectingFeed({
  fetchSnapshot: fetchQuotes,
  createFeed: createSimulator,
  onSnapshot: (snapshot) => {
    quotes = snapshot;
    lastAcceptedTickAt = Date.now();
    notifySubscribers();
  },
  onTick: handleTick,
  onState: (next) => {
    status = next;
    notifySubscribers();
  },
});

function notifySubscribers(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToMarket(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Event subscription preserves each accepted price tick even when React batches renders. */
export function subscribeToPriceTicks(listener: (tick: PriceTick) => void): () => void {
  priceTickListeners.add(listener);
  return () => {
    priceTickListeners.delete(listener);
  };
}

/** Read-only snapshot for derived subscriptions, such as the sorted symbol order. */
export function getQuotesSnapshot(): Readonly<Record<string, Quote>> {
  return quotes;
}

/** A row reads one quote; unrelated quotes retain their object identity. */
export function useQuote(symbol: string): Quote | undefined {
  return useSyncExternalStore(subscribeToMarket, () => quotes[symbol]);
}

/** Use only for views, such as the summary, that need every price update. */
export function useQuotes(): Readonly<Record<string, Quote>> {
  return useSyncExternalStore(subscribeToMarket, () => quotes);
}

export function useMarketStatus(): MarketStatus {
  return useSyncExternalStore(subscribeToMarket, () => status);
}

function handleTick(tick: Tick): void {
  const previousQuote = quotes[tick.symbol];
  const updatedQuote = mergeTick(previousQuote, tick);

  // Rejected ticks keep the same reference and must not notify React.
  if (!updatedQuote || updatedQuote === previousQuote) return;

  quotes = { ...quotes, [tick.symbol]: updatedQuote };
  lastAcceptedTickAt = Date.now();
  // Emit only a valid supplied price. Partial ticks must not fabricate chart points.
  if (tick.ltp !== undefined && Number.isSafeInteger(tick.ltp) && tick.ltp >= 0) {
    const priceTick: PriceTick = {
      symbol: tick.symbol,
      price: tick.ltp,
      receivedAt: lastAcceptedTickAt,
    };
    for (const listener of priceTickListeners) listener(priceTick);
  }
  notifySubscribers();
}

function checkFeedHealth(): void {
  if (status.loading || status.paused) return;
  // A valid REST response may omit every requested price. There is no stream to
  // recover in that case; leave -- visible and wait for explicit refresh.
  if (!Object.values(quotes).some((quote) => quote.ltp !== undefined)) return;
  if (Date.now() - lastAcceptedTickAt > PAUSED_AFTER_MS) connection.recover();
}

export async function loadMarket(): Promise<void> {
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  healthCheckTimer = setInterval(checkFeedHealth, HEALTH_CHECK_INTERVAL_MS);
  await connection.start();
}

export function stopMarket(): void {
  connection.stop();
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  healthCheckTimer = undefined;
}
