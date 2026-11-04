import { useSyncExternalStore } from 'react';
import { fetchQuotes } from '../data/api';
import { mergeTick, type Quote } from '../domain/portfolio';
import { createSimulator, type PriceFeed } from '../feed/simulator';

const listeners = new Set<() => void>();
let quotes: Readonly<Record<string, Quote>> = {};
let status: Readonly<{ loading: boolean; error?: string; paused: boolean }> = { loading: true, paused: false };
let feed: PriceFeed | undefined;
let unsubscribe: (() => void) | undefined;
let watchdog: ReturnType<typeof setInterval> | undefined;
let lastTick = 0;
let generation = 0;
const emit = () => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useQuote(symbol: string) {
  return useSyncExternalStore(subscribe, () => quotes[symbol]);
}
export function useQuotes() { return useSyncExternalStore(subscribe, () => quotes); }
export function useMarketStatus() { return useSyncExternalStore(subscribe, () => status); }
function stopFeed() {
  feed?.disconnect(); unsubscribe?.();
  if (watchdog) clearInterval(watchdog);
  watchdog = undefined;
}
export async function loadMarket() {
  const request = ++generation;
  stopFeed();
  status = { loading: true, paused: false }; emit();
  try {
    const received = await fetchQuotes();
    if (request !== generation) return;
    quotes = received;
    status = { loading: false, paused: false };
    lastTick = Date.now();
    feed = createSimulator(received);
    unsubscribe = feed.onTick(tick => {
      const merged = mergeTick(quotes[tick.symbol], tick);
      if (merged === quotes[tick.symbol] || !merged) return;
      quotes = { ...quotes, [tick.symbol]: merged };
      lastTick = Date.now();
      if (status.paused) status = { ...status, paused: false };
      emit();
    });
    feed.connect();
    watchdog = setInterval(() => {
      const paused = Date.now() - lastTick > 2000;
      if (paused !== status.paused) { status = { ...status, paused }; emit(); }
    }, 500);
    emit();
  } catch (error: unknown) {
    if (request !== generation) return;
    status = { loading: false, paused: true, error: error instanceof Error ? error.message : 'Could not load prices.' };
    emit();
  }
}
export function stopMarket() { generation++; stopFeed(); }
