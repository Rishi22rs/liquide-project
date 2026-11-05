import type { TradingEvent, TradeSide } from './trading';

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};
export type HistoryStatus = 'pending' | 'filled' | 'cancelled' | 'rejected' | 'expired';
export type HistoryEntry = Readonly<{
  id: string;
  sessionId: string;
  symbol: string;
  side: TradeSide;
  type: 'market' | 'limit';
  quantity: number;
  status: HistoryStatus;
  createdAt: number;
  updatedAt: number;
  limitPricePaise?: number;
  pricePaise?: number;
  valuePaise?: number;
  filledAt?: number;
  error?: string;
}>;
export type HistoryState = Readonly<{
  entries: readonly HistoryEntry[];
  hydrated: boolean;
  saving: boolean;
  loadFailed: boolean;
  error?: string;
}>;
const STORAGE_KEY = 'liquide.orderHistory.v1';
const statuses: readonly string[] = [
  'pending',
  'filled',
  'cancelled',
  'rejected',
  'expired',
];
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
function isStatus(value: unknown): value is HistoryStatus {
  return typeof value === 'string' && statuses.includes(value);
}

/** Reject corrupt history as a whole rather than silently overwriting an audit
 * trail. Rebuild known fields only; do not trust arbitrary stored object shapes. */
export function parseOrderHistory(raw: string | null): readonly HistoryEntry[] {
  if (raw === null) return [];
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data) || data.version !== 1 || !Array.isArray(data.entries))
    throw new Error('Invalid saved order history.');
  const seen = new Set<string>();
  return data.entries.map((value: unknown): HistoryEntry => {
    if (
      !isRecord(value) ||
      typeof value.id !== 'string' ||
      !value.id ||
      seen.has(value.id) ||
      typeof value.sessionId !== 'string' ||
      !value.sessionId ||
      typeof value.symbol !== 'string' ||
      !/^[A-Z0-9&._-]{1,32}$/.test(value.symbol) ||
      (value.side !== 'buy' && value.side !== 'sell') ||
      (value.type !== 'market' && value.type !== 'limit') ||
      !positive(value.quantity) ||
      !positive(value.createdAt) ||
      !positive(value.updatedAt) ||
      !isStatus(value.status)
    )
      throw new Error('Invalid saved order history.');
    if (value.type === 'market' && value.status !== 'filled')
      throw new Error('Invalid saved market order.');
    if (
      value.type === 'limit' &&
      (!positive(value.limitPricePaise) ||
        !Number.isSafeInteger(value.quantity * value.limitPricePaise))
    )
      throw new Error('Invalid saved limit price.');
    if (
      value.status === 'filled' &&
      (!positive(value.pricePaise) ||
        !positive(value.valuePaise) ||
        !positive(value.filledAt) ||
        !Number.isSafeInteger(value.quantity * value.pricePaise) ||
        value.quantity * value.pricePaise !== value.valuePaise)
    )
      throw new Error('Invalid saved fill.');
    if (value.status === 'rejected' && (typeof value.error !== 'string' || !value.error))
      throw new Error('Invalid saved rejection.');
    seen.add(value.id);
    return {
      id: value.id,
      sessionId: value.sessionId,
      symbol: value.symbol,
      side: value.side,
      type: value.type,
      quantity: value.quantity,
      status: value.status,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
      limitPricePaise:
        value.type === 'limit' && positive(value.limitPricePaise)
          ? value.limitPricePaise
          : undefined,
      pricePaise:
        value.status === 'filled' && positive(value.pricePaise)
          ? value.pricePaise
          : undefined,
      valuePaise:
        value.status === 'filled' && positive(value.valuePaise)
          ? value.valuePaise
          : undefined,
      filledAt:
        value.status === 'filled' && positive(value.filledAt)
          ? value.filledAt
          : undefined,
      error:
        value.status === 'rejected' && typeof value.error === 'string'
          ? value.error
          : undefined,
    };
  });
}

function entryFromEvent(event: TradingEvent, sessionId: string): HistoryEntry {
  if (event.type === 'market') {
    const fill = event.fill;
    return {
      id: fill.id,
      sessionId,
      symbol: fill.symbol,
      side: fill.side,
      quantity: fill.quantity,
      type: 'market',
      status: 'filled',
      createdAt: fill.filledAt,
      updatedAt: fill.filledAt,
      pricePaise: fill.pricePaise,
      valuePaise: fill.valuePaise,
      filledAt: fill.filledAt,
    };
  }
  const order = event.order;
  return {
    id: order.id,
    sessionId,
    symbol: order.symbol,
    side: order.side,
    quantity: order.quantity,
    type: 'limit',
    status: order.status,
    createdAt: order.placedAt,
    updatedAt: event.updatedAt,
    limitPricePaise: order.limitPricePaise,
    pricePaise: order.status === 'filled' ? order.fill.pricePaise : undefined,
    valuePaise: order.status === 'filled' ? order.fill.valuePaise : undefined,
    filledAt: order.status === 'filled' ? order.fill.filledAt : undefined,
    error: order.status === 'rejected' ? order.error : undefined,
  };
}

function newestFirst(entries: Iterable<HistoryEntry>): readonly HistoryEntry[] {
  return [...entries].sort(
    (a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id),
  );
}

/** History persists independently of session positions. New events can arrive
 * during hydration: buffer and merge them, and never write before a successful read. */
export function createOrderHistoryStore(
  storage: Storage,
  sessionId: string,
  now: () => number = Date.now,
) {
  let state: HistoryState = {
    entries: [],
    hydrated: false,
    saving: false,
    loadFailed: false,
  };
  const listeners = new Set<() => void>();
  const buffered = new Map<string, HistoryEntry>();
  let loading: Promise<void> | undefined;
  let queue = Promise.resolve();
  let revision = 0;
  function publish(next: HistoryState) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  function persist() {
    const entries = state.entries;
    const currentRevision = ++revision;
    publish({ ...state, saving: true, error: undefined });
    queue = queue.then(async () => {
      try {
        await storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries }));
        if (currentRevision === revision)
          publish({ ...state, saving: false, error: undefined });
      } catch {
        if (currentRevision === revision)
          publish({
            ...state,
            saving: false,
            error:
              'Order history could not be saved. New activity is still in memory. Retry saving.',
          });
      }
    });
  }
  async function load() {
    if (state.hydrated && !state.loadFailed) return;
    if (loading) return loading;
    publish({ ...state, error: undefined, loadFailed: false });
    loading = (async () => {
      try {
        const saved = parseOrderHistory(await storage.getItem(STORAGE_KEY));
        let expired = false;
        const merged = new Map(
          saved.map((entry) => {
            // Positions intentionally reset on restart. Never replay or reserve
            // against a past session's pending order; retain it as expired history.
            if (entry.status === 'pending' && entry.sessionId !== sessionId) {
              expired = true;
              return [
                entry.id,
                { ...entry, status: 'expired' as const, updatedAt: now() },
              ] as const;
            }
            return [entry.id, entry] as const;
          }),
        );
        const changed = buffered.size > 0 || expired;
        for (const [id, entry] of buffered) merged.set(id, entry);
        buffered.clear();
        publish({
          entries: newestFirst(merged.values()),
          hydrated: true,
          saving: false,
          loadFailed: false,
        });
        if (changed) persist();
      } catch {
        publish({
          ...state,
          hydrated: false,
          loadFailed: true,
          error:
            'Saved order history could not be loaded. New activity stays in memory. Retry to recover it.',
        });
      }
    })();
    await loading;
    loading = undefined;
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load,
    record(event: TradingEvent) {
      const entry = entryFromEvent(event, sessionId);
      const entries = new Map(state.entries.map((item) => [item.id, item]));
      entries.set(entry.id, entry);
      publish({ ...state, entries: newestFirst(entries.values()) });
      if (!state.hydrated || state.loadFailed) buffered.set(entry.id, entry);
      else persist();
    },
    retry() {
      if (!state.hydrated || state.loadFailed) void load();
      else persist();
    },
    waitForSaves: () => queue,
  };
}
