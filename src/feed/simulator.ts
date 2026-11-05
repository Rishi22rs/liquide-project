import type { Quote, Tick } from '../domain/portfolio';
import type { PriceFeed } from './types';
const TICK_INTERVAL_MS = 50;
const ACTIVE_DURATION_MS = 60_000;
const SILENT_DURATION_MS = 5_000;
const MAX_PRICE_CHANGE = 0.002;
const LATE_TICK_PROBABILITY = 0.02;

export function createSimulator(initial: Readonly<Record<string, Quote>>): PriceFeed {
  const quotes = { ...initial };
  const symbols = Object.keys(quotes).filter(
    (symbol) => quotes[symbol]?.ltp !== undefined,
  );
  const listeners = new Set<(tick: Tick) => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let started = 0;
  let connectionGeneration = 0;
  let unavailableUntil = 0;
  const disconnectListeners = new Set<() => void>();
  return {
    onDisconnect(handler) {
      disconnectListeners.add(handler);
      return () => {
        disconnectListeners.delete(handler);
      };
    },
    onTick(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
    connect() {
      if (Date.now() < unavailableUntil)
        throw new Error('Price feed is temporarily unavailable.');
      if (timer !== undefined || !symbols.length) return;
      const epoch = ++connectionGeneration;
      started = Date.now();
      timer = setInterval(() => {
        if (epoch !== connectionGeneration || timer === undefined) return;
        if (Date.now() - started >= ACTIVE_DURATION_MS) {
          // Preserve this outage across connect attempts; reconnect must not skip
          // the five-second pause by resetting the simulator's clock.
          unavailableUntil = Date.now() + SILENT_DURATION_MS;
          clearInterval(timer);
          timer = undefined;
          connectionGeneration++;
          for (const listener of disconnectListeners) listener();
          return;
        }
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        if (!symbol) return;
        const previous = quotes[symbol];
        if (!previous || previous.ltp === undefined) return;
        const ltp = Math.max(
          1,
          Math.round(previous.ltp * (1 + (Math.random() - 0.5) * 2 * MAX_PRICE_CHANGE)),
        );
        const tick: Tick = { symbol, seq: previous.seq + 1, ltp };
        if (previous.high !== undefined && ltp > previous.high) tick.high = ltp;
        if (previous.low !== undefined && ltp < previous.low) tick.low = ltp;
        if (previous.volume !== undefined && Math.random() < 0.3)
          tick.volume = previous.volume + Math.ceil(Math.random() * 100);
        quotes[symbol] = { ...previous, ...tick };
        // A deliberately old sequence exercises the consumer's rejection logic.
        const delivered =
          Math.random() < LATE_TICK_PROBABILITY
            ? { ...tick, seq: Math.max(0, previous.seq - 1) }
            : tick;
        for (const listener of listeners) listener(delivered);
      }, TICK_INTERVAL_MS);
    },
    disconnect() {
      connectionGeneration++;
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    },
  };
}
