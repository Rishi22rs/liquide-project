import { useSyncExternalStore } from 'react';
import { fetchQuotes } from '../data/api';
import { mergeTick, type Quote, type Tick } from '../domain/portfolio';
import { createSimulator, type PriceFeed } from '../feed/simulator';

type MarketStatus = Readonly<{
  loading: boolean;
  error?: string;
  paused: boolean;
}>;

const PAUSED_AFTER_MS = 2_000;
const HEALTH_CHECK_INTERVAL_MS = 500;
const listeners = new Set<() => void>();

// Quotes and status have separate snapshot identities. A price tick should not
// render components that only care about connection/loading status.
let quotes: Readonly<Record<string, Quote>> = {};
let status: MarketStatus = { loading: true, paused: false };
let feed: PriceFeed | undefined;
let unsubscribeFromFeed: (() => void) | undefined;
let healthCheckTimer: ReturnType<typeof setInterval> | undefined;
let lastAcceptedTickAt = 0;
let requestGeneration = 0;

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

function stopFeed(): void {
  feed?.disconnect();
  unsubscribeFromFeed?.();
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  feed = undefined;
  unsubscribeFromFeed = undefined;
  healthCheckTimer = undefined;
}

function handleTick(tick: Tick): void {
  const previousQuote = quotes[tick.symbol];
  const updatedQuote = mergeTick(previousQuote, tick);

  // Rejected ticks keep the same reference and must not notify React.
  if (!updatedQuote || updatedQuote === previousQuote) return;

  quotes = { ...quotes, [tick.symbol]: updatedQuote };
  lastAcceptedTickAt = Date.now();
  if (status.paused) status = { ...status, paused: false };
  notifySubscribers();
}

function checkFeedHealth(): void {
  const paused = Date.now() - lastAcceptedTickAt > PAUSED_AFTER_MS;
  if (paused === status.paused) return;

  status = { ...status, paused };
  notifySubscribers();
}

export async function loadMarket(): Promise<void> {
  // A newer refresh or unmount invalidates older requests, even if they finish later.
  const currentRequest = ++requestGeneration;
  stopFeed();
  status = { loading: true, paused: false };
  notifySubscribers();

  try {
    const receivedQuotes = await fetchQuotes();
    if (currentRequest !== requestGeneration) return;

    quotes = receivedQuotes;
    status = { loading: false, paused: false };
    lastAcceptedTickAt = Date.now();

    // This is the only place that chooses the feed implementation. Screens use
    // quotes, not the simulator, so a real socket can replace it here later.
    feed = createSimulator(receivedQuotes);
    unsubscribeFromFeed = feed.onTick(handleTick);
    feed.connect();
    healthCheckTimer = setInterval(checkFeedHealth, HEALTH_CHECK_INTERVAL_MS);
    notifySubscribers();
  } catch (error: unknown) {
    if (currentRequest !== requestGeneration) return;

    // Preserve previously fetched quotes on a refresh error; label them paused.
    status = {
      loading: false,
      paused: true,
      error: error instanceof Error ? error.message : 'Could not load prices.',
    };
    notifySubscribers();
  }
}

export function stopMarket(): void {
  requestGeneration++;
  stopFeed();
}
