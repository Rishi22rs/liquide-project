export type WatchlistStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};
export type WatchlistState = Readonly<{
  symbols: readonly string[];
  hydrated: boolean;
  saving: boolean;
  loadFailed: boolean;
  error?: string;
}>;
const STORAGE_KEY = 'liquide.watchlist.v1';

/** Stored data is untrusted: discard unknown symbols and duplicates, but report
 * malformed storage rather than silently replacing the user's saved list. */
export function parseWatchlist(
  raw: string | null,
  allowedSymbols: readonly string[],
): readonly string[] {
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error('Invalid saved watchlist');
  }
  return [
    ...new Set((parsed as string[]).filter((symbol) => allowedSymbols.includes(symbol))),
  ];
}

/** Storage is injected so ordering, hydration and failure recovery can be tested
 * without a phone. React subscribes through the small wrapper in state/watchlist. */
export function createWatchlistStore(
  storage: WatchlistStorage,
  allowedSymbols: readonly string[],
) {
  let state: WatchlistState = {
    symbols: [],
    hydrated: false,
    saving: false,
    loadFailed: false,
  };
  const listeners = new Set<() => void>();
  let loading: Promise<void> | undefined;
  let saveQueue = Promise.resolve();
  let revision = 0;

  function publish(next: WatchlistState) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  function persist(symbols: readonly string[]) {
    const currentRevision = ++revision;
    publish({ ...state, symbols, saving: true, error: undefined });
    // Serialize writes so a slow earlier edit cannot overwrite the latest list.
    saveQueue = saveQueue.then(async () => {
      try {
        await storage.setItem(STORAGE_KEY, JSON.stringify(symbols));
        if (currentRevision === revision)
          publish({ ...state, saving: false, error: undefined });
      } catch {
        if (currentRevision === revision) {
          publish({
            ...state,
            saving: false,
            error: 'Your changes could not be saved. Please retry.',
          });
        }
      }
    });
  }

  async function load() {
    if (state.hydrated && !state.loadFailed) return;
    if (loading) return loading;
    publish({ ...state, hydrated: false, error: undefined });
    loading = (async () => {
      try {
        const raw = await storage.getItem(STORAGE_KEY);
        const symbols = parseWatchlist(raw, allowedSymbols);
        publish({ symbols, hydrated: true, saving: false, loadFailed: false });
      } catch {
        publish({
          ...state,
          hydrated: true,
          loadFailed: true,
          error: 'Your saved watchlist could not be loaded. Please retry.',
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
    add(symbol: string) {
      // Never overwrite storage before hydration, or while recovering a failed read.
      if (
        !state.hydrated ||
        state.loadFailed ||
        !allowedSymbols.includes(symbol) ||
        state.symbols.includes(symbol)
      )
        return;
      persist([...state.symbols, symbol]);
    },
    remove(symbol: string) {
      if (!state.hydrated || state.loadFailed || !state.symbols.includes(symbol)) return;
      persist(state.symbols.filter((saved) => saved !== symbol));
    },
    retry() {
      if (state.loadFailed) {
        void load();
      } else if (state.hydrated) persist(state.symbols);
    },
    // Exposed for persistence tests; UI uses saving/error from the snapshot.
    waitForSaves: () => saveQueue,
  };
}
