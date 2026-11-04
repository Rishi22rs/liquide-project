import type { Quote, Tick } from '../domain/portfolio';
// Screens and state rely on this contract, not on how ticks are produced.
export interface PriceFeed {
  connect(): void;
  disconnect(): void;
  onTick(handler: (tick: Tick) => void): () => void;
}
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
  return {
    onTick(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
    connect() {
      if (timer || !symbols.length) return;
      started = Date.now();
      timer = setInterval(() => {
        if (
          (Date.now() - started) % (ACTIVE_DURATION_MS + SILENT_DURATION_MS) >=
          ACTIVE_DURATION_MS
        )
          return;
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
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
}
