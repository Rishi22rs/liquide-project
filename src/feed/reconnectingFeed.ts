import type { Quote, Tick } from '../domain/portfolio';
import type { PriceFeed } from './types';

type Snapshot = Readonly<Record<string, Quote>>;
type ConnectionState = Readonly<{
  loading: boolean;
  paused: boolean;
  error?: string;
  reconnecting?: boolean;
}>;
type Options = {
  fetchSnapshot: (signal: AbortSignal) => Promise<Snapshot>;
  createFeed: (snapshot: Snapshot) => PriceFeed;
  onSnapshot: (snapshot: Snapshot) => void;
  onTick: (tick: Tick) => void;
  onState: (state: ConnectionState) => void;
  schedule?: (callback: () => void, delay: number) => () => void;
};

export function reconnectDelay(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.min(5, Math.max(0, attempt - 1)));
}

/** One owner for connection recovery. Probe the transport before a catch-up
 * request, then seed a fresh stream so old sequences/prices cannot cross epochs.
 * No REST requests run while the transport is known to be unavailable. */
export function createReconnectingFeed(options: Options) {
  const schedule =
    options.schedule ??
    ((callback, delay) => {
      const timer = setTimeout(callback, delay);
      return () => clearTimeout(timer);
    });
  let generation = 0;
  let transport: PriceFeed | undefined;
  let unlisten: (() => void)[] = [];
  let cancelRetry: (() => void) | undefined;
  let request: AbortController | undefined;
  let attempt = 0;
  let recovering = false;
  let running = false;

  function detach() {
    unlisten.forEach((unsubscribe) => unsubscribe());
    unlisten = [];
    transport?.disconnect();
  }

  function install(snapshot: Snapshot, epoch: number) {
    detach();
    const next = options.createFeed(snapshot);
    transport = next;
    unlisten = [
      next.onTick((tick) => {
        if (running && generation === epoch && transport === next && !recovering)
          options.onTick(tick);
      }),
      next.onDisconnect(() => {
        if (running && generation === epoch && transport === next) recover();
      }),
    ];
    next.connect();
  }

  function queueRetry(epoch: number, message?: string) {
    if (!running || epoch !== generation) return;
    attempt++;
    const delay = reconnectDelay(attempt);
    options.onState({
      loading: false,
      paused: true,
      reconnecting: true,
      error: `${message ?? 'Price connection lost.'} Reconnecting in ${delay / 1000}s (attempt ${attempt}).`,
    });
    cancelRetry = schedule(() => {
      cancelRetry = undefined;
      void retry(epoch);
    }, delay);
  }

  async function retry(epoch: number) {
    if (!running || epoch !== generation) return;
    options.onState({
      loading: false,
      paused: true,
      reconnecting: true,
      error: 'Reconnecting to prices…',
    });
    try {
      // A failed probe schedules backoff without hitting the shared REST server.
      transport?.connect();
      transport?.disconnect();
      request = new AbortController();
      const snapshot = await options.fetchSnapshot(request.signal);
      if (!running || epoch !== generation) return;
      // Snapshot publication and stream replacement are synchronous. Retired
      // stream callbacks are guarded by both identity and generation.
      install(snapshot, epoch);
      options.onSnapshot(snapshot);
      recovering = false;
      attempt = 0;
      options.onState({ loading: false, paused: false });
    } catch (error: unknown) {
      if (!running || epoch !== generation) return;
      detach();
      queueRetry(epoch, error instanceof Error ? error.message : 'Could not reconnect.');
    }
  }

  function recover() {
    if (!running || recovering) return;
    recovering = true;
    detach();
    queueRetry(generation);
  }

  function stop() {
    running = false;
    generation++;
    cancelRetry?.();
    cancelRetry = undefined;
    request?.abort();
    request = undefined;
    detach();
    transport = undefined;
    recovering = false;
    attempt = 0;
  }

  return {
    async start() {
      stop();
      running = true;
      const epoch = generation;
      options.onState({ loading: true, paused: false });
      request = new AbortController();
      try {
        const snapshot = await options.fetchSnapshot(request.signal);
        if (!running || epoch !== generation) return;
        recovering = true;
        install(snapshot, epoch);
        options.onSnapshot(snapshot);
        recovering = false;
        options.onState({ loading: false, paused: false });
      } catch (error: unknown) {
        if (!running || epoch !== generation) return;
        detach();
        options.onState({
          loading: false,
          paused: true,
          error: error instanceof Error ? error.message : 'Could not load prices.',
        });
      }
    },
    // Silence detection also works with a socket that fails without a close event.
    recover,
    stop,
  };
}
