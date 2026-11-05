import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWatchlistStore, parseWatchlist } from '../src/domain/watchlist.ts';
import { dayChange } from '../src/domain/portfolio.ts';

const allowed = ['RELIANCE', 'TCS', 'INFY'];
function memoryStorage(initial = null) {
  let saved = initial;
  return {
    getItem: async () => saved,
    setItem: async (_, value) => {
      saved = value;
    },
  };
}

test('hydration validates saved symbols, removes duplicates and rejects malformed data', () => {
  assert.deepEqual(parseWatchlist(null, allowed), []);
  assert.deepEqual(parseWatchlist('["TCS","TCS","OLDCO","INFY"]', allowed), [
    'TCS',
    'INFY',
  ]);
  assert.throws(() => parseWatchlist('{"symbols": []}', allowed));
  assert.throws(() => parseWatchlist('[1]', allowed));
  assert.throws(() => parseWatchlist('broken', allowed));
});
test('adding before hydration cannot overwrite the saved list', async () => {
  const store = createWatchlistStore(memoryStorage('["TCS"]'), allowed);
  store.add('RELIANCE');
  await store.load();
  assert.deepEqual(store.getSnapshot().symbols, ['TCS']);
});
test('add/remove is unique, allowed-only, immediate and survives a new store instance', async () => {
  const storage = memoryStorage();
  const store = createWatchlistStore(storage, allowed);
  await store.load();
  store.add('TCS');
  store.add('TCS');
  store.add('OLDCO');
  store.add('INFY');
  assert.deepEqual(store.getSnapshot().symbols, ['TCS', 'INFY']);
  store.remove('TCS');
  assert.deepEqual(store.getSnapshot().symbols, ['INFY']);
  await store.waitForSaves();
  const restarted = createWatchlistStore(storage, allowed);
  await restarted.load();
  assert.deepEqual(restarted.getSnapshot().symbols, ['INFY']);
});
test('rapid edits serialize storage writes so the latest selection wins', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  let saved;
  const storage = {
    getItem: async () => null,
    setItem: async (_, value) => {
      inFlight++;
      maxInFlight = Math.max(inFlight, maxInFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      saved = value;
      inFlight--;
    },
  };
  const store = createWatchlistStore(storage, allowed);
  await store.load();
  store.add('TCS');
  store.add('INFY');
  store.remove('TCS');
  await store.waitForSaves();
  assert.equal(maxInFlight, 1);
  assert.equal(saved, '["INFY"]');
  assert.equal(store.getSnapshot().saving, false);
});
test('failed read blocks edits until retry succeeds', async () => {
  let fail = true;
  const store = createWatchlistStore(
    {
      getItem: async () => {
        if (fail) throw new Error('Storage unavailable');
        return '["TCS"]';
      },
      setItem: async () => {
        throw new Error('Should not write');
      },
    },
    allowed,
  );
  await store.load();
  assert.equal(store.getSnapshot().loadFailed, true);
  store.add('INFY');
  assert.deepEqual(store.getSnapshot().symbols, []);
  fail = false;
  await store.load();
  assert.deepEqual(store.getSnapshot().symbols, ['TCS']);
  assert.equal(store.getSnapshot().error, undefined);
});
test('failed save preserves the local list and retry persists it', async () => {
  let fail = true;
  let saved;
  const store = createWatchlistStore(
    {
      getItem: async () => null,
      setItem: async (_, value) => {
        if (fail) throw new Error('Disk full');
        saved = value;
      },
    },
    allowed,
  );
  await store.load();
  store.add('TCS');
  await store.waitForSaves();
  assert.ok(store.getSnapshot().error);
  assert.deepEqual(store.getSnapshot().symbols, ['TCS']);
  fail = false;
  store.retry();
  await store.waitForSaves();
  assert.equal(saved, '["TCS"]');
  assert.equal(store.getSnapshot().error, undefined);
});
test('watchlist day change handles loss, missing data and zero denominator', () => {
  assert.deepEqual(dayChange({ symbol: 'TCS', seq: 1, ltp: 900, prevClose: 1000 }), {
    amount: -100,
    percentage: -10,
  });
  assert.deepEqual(dayChange(), { amount: undefined, percentage: undefined });
  assert.deepEqual(dayChange({ symbol: 'TCS', seq: 1, ltp: 900 }), {
    amount: undefined,
    percentage: undefined,
  });
  assert.deepEqual(dayChange({ symbol: 'TCS', seq: 1, ltp: 900, prevClose: 0 }), {
    amount: 900,
    percentage: undefined,
  });
});
