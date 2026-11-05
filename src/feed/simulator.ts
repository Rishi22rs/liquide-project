import type { Quote, Tick } from '../domain/portfolio';
import type { PriceFeed } from './types';
export const SIMULATOR_TICK_RATES = [5, 20, 50, 100] as const;
export const DEFAULT_TICK_RATE = 20;
export interface SimulatorFeed extends PriceFeed {
  setTickRate(rate: number): boolean;
  forceDisconnect(): boolean;
  isConnected(): boolean;
}
function validRate(rate: number): boolean {
  return Number.isInteger(rate) && rate >= 1 && rate <= 100;
}
const ACTIVE_DURATION_MS = 60_000;
const SILENT_DURATION_MS = 5_000;
const MAX_PRICE_CHANGE = 0.002;
const LATE_TICK_PROBABILITY = 0.02;

export function createSimulator(
  initial: Readonly<Record<string, Quote>>,
  initialTickRate = DEFAULT_TICK_RATE,
): SimulatorFeed {
  let tickRate = validRate(initialTickRate) ? initialTickRate : DEFAULT_TICK_RATE;
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
  function stopTimer() {
    connectionGeneration++;
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  }
  function dropConnection(): boolean {
    if (timer === undefined) return false;
    unavailableUntil = Date.now() + SILENT_DURATION_MS;
    stopTimer();
    for (const listener of disconnectListeners) listener();
    return true;
  }
  function armTimer() {
    stopTimer();
    const epoch = connectionGeneration;
    timer = setInterval(
      () => {
        if (epoch !== connectionGeneration || timer === undefined) return;
        if (Date.now() - started >= ACTIVE_DURATION_MS) {
          // Preserve this outage across connect attempts; reconnect must not skip
          // the five-second pause by resetting the simulator's clock.
          dropConnection();
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
      },
      Math.round(1000 / tickRate),
    );
  }
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
      started = Date.now();
      armTimer();
    },
    disconnect: stopTimer,
    isConnected: () => timer !== undefined,
    forceDisconnect: dropConnection,
    setTickRate(rate) {
      if (!validRate(rate)) return false;
      if (rate === tickRate) return true;
      tickRate = rate;
      // Change only the timer cadence: retain quotes, sequence numbers and the
      // minute's original start time, and never reconnect a paused feed here.
      if (timer !== undefined) armTimer();
      return true;
    },
  };
}
