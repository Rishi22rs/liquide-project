import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createOrderHistoryStore,
  parseOrderHistory,
} from '../src/domain/orderHistory.ts';
import { createTradingStore } from '../src/domain/trading.ts';
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
const pending = (id = 'limit') => ({
  type: 'limit',
  updatedAt: 1000,
  order: {
    id,
    symbol: 'TCS',
    side: 'buy',
    quantity: 2,
    limitPricePaise: 9500,
    placedAt: 1000,
    status: 'pending',
  },
});
const fill = (id = 'market') => ({
  type: 'market',
  fill: {
    id,
    symbol: 'TCS',
    side: 'buy',
    quantity: 2,
    pricePaise: 10000,
    valuePaise: 20000,
    filledAt: 1000,
    remainingQuantity: 2,
    averagePricePaise: 10000,
  },
});
function memoryStorage(initial = null) {
  let raw = initial;
  return {
    reads: 0,
    writes: [],
    failRead: false,
    failWrite: false,
    async getItem() {
      this.reads++;
      if (this.failRead) throw new Error('Read failed');
      return raw;
    },
    async setItem(_key, value) {
      if (this.failWrite) throw new Error('Write failed');
      this.writes.push(value);
      raw = value;
    },
    raw: () => raw,
    setRaw: (value) => {
      raw = value;
    },
  };
}

test('confirmed market fills survive restart with captured values; replays do not duplicate history', async () => {
  const storage = memoryStorage();
  const history = createOrderHistoryStore(storage, 'first', () => 2000);
  await history.load();
  let price = 10000;
  const trades = createTradingStore(
    [],
    (symbol) => ({ symbol, seq: 0, ltp: price }),
    ['TCS'],
    () => 1000,
    history.record,
  );
  const request = { id: 'market', symbol: 'TCS', side: 'buy', quantity: 2 };
  trades.submit(request);
  price = 11000;
  trades.submit(request);
  await history.waitForSaves();
  assert.equal(history.getSnapshot().entries.length, 1);
  const restored = createOrderHistoryStore(storage, 'second', () => 2000);
  await restored.load();
  assert.equal(restored.getSnapshot().entries[0].pricePaise, 10000);
  assert.equal(restored.getSnapshot().entries[0].valuePaise, 20000);
  assert.equal(restored.getSnapshot().entries[0].status, 'filled');
});

test('limit fill and cancellation update one record per ID instead of appending duplicate statuses', async () => {
  const storage = memoryStorage();
  const history = createOrderHistoryStore(storage, 'session');
  await history.load();
  const trades = createTradingStore(
    [],
    (symbol) => ({ symbol, seq: 0, ltp: 10000 }),
    ['TCS'],
    () => 1000,
    history.record,
  );
  const request = { ...pending().order };
  delete request.placedAt;
  delete request.status;
  trades.placeLimit(request);
  trades.processPriceTick('TCS', 9400);
  trades.placeLimit({ ...request, id: 'cancelled' });
  trades.cancelLimit('cancelled');
  await history.waitForSaves();
  const entries = parseOrderHistory(storage.raw());
  assert.equal(entries.length, 2);
  assert.equal(entries.find((e) => e.id === 'limit').status, 'filled');
  assert.equal(entries.find((e) => e.id === 'limit').pricePaise, 9400);
  assert.equal(entries.find((e) => e.id === 'cancelled').status, 'cancelled');
});

test('prior-session pending orders expire on restart and the expiry itself is persisted', async () => {
  const storage = memoryStorage();
  const first = createOrderHistoryStore(storage, 'first');
  await first.load();
  first.record(pending());
  first.record(fill());
  await first.waitForSaves();
  const second = createOrderHistoryStore(storage, 'second', () => 2000);
  await second.load();
  await second.waitForSaves();
  const entries = second.getSnapshot().entries;
  assert.equal(entries.find((e) => e.id === 'limit').status, 'expired');
  assert.equal(entries.find((e) => e.id === 'limit').updatedAt, 2000);
  assert.equal(entries.find((e) => e.id === 'market').status, 'filled');
  assert.equal(
    parseOrderHistory(storage.raw()).find((e) => e.id === 'limit').status,
    'expired',
  );
});

test('hydration merges orders received before and during the read without overwriting saved history', async () => {
  const storage = memoryStorage();
  const seed = createOrderHistoryStore(storage, 'old');
  await seed.load();
  seed.record(fill('old'));
  await seed.waitForSaves();
  const saved = storage.raw();
  let finishRead;
  storage.getItem = () =>
    new Promise((resolve) => {
      finishRead = resolve;
    });
  const history = createOrderHistoryStore(storage, 'new');
  history.record(pending('new'));
  const loading = history.load();
  history.record({
    ...pending('new'),
    updatedAt: 1200,
    order: { ...pending('new').order, status: 'cancelled' },
  });
  assert.equal(storage.writes.length, 1);
  finishRead(saved);
  await loading;
  await history.waitForSaves();
  assert.equal(history.getSnapshot().entries.length, 2);
  assert.equal(
    history.getSnapshot().entries.find((e) => e.id === 'new').status,
    'cancelled',
  );
  assert.equal(parseOrderHistory(storage.raw()).length, 2);
});

test('concurrent load calls share one storage read', async () => {
  const storage = memoryStorage();
  let finish;
  let reads = 0;
  storage.getItem = () => {
    reads++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  const history = createOrderHistoryStore(storage, 'session');
  const first = history.load();
  const second = history.load();
  finish(null);
  await Promise.all([first, second]);
  assert.equal(reads, 1);
});

test('corrupt history blocks writes while preserving new in-memory activity until retry succeeds', async () => {
  const storage = memoryStorage('{broken');
  const history = createOrderHistoryStore(storage, 'session');
  await history.load();
  history.record(fill());
  await history.waitForSaves();
  assert.equal(history.getSnapshot().loadFailed, true);
  assert.equal(history.getSnapshot().entries.length, 1);
  assert.equal(storage.writes.length, 0);
  storage.setRaw(null);
  history.retry();
  await flush();
  await history.waitForSaves();
  assert.equal(history.getSnapshot().hydrated, true);
  assert.equal(parseOrderHistory(storage.raw()).length, 1);
});

test('storage read failure offers recovery without replacing the old saved history', async () => {
  const storage = memoryStorage();
  const seed = createOrderHistoryStore(storage, 'old');
  await seed.load();
  seed.record(fill('old'));
  await seed.waitForSaves();
  storage.failRead = true;
  const history = createOrderHistoryStore(storage, 'new');
  await history.load();
  history.record(fill('new'));
  assert.equal(storage.writes.length, 1);
  storage.failRead = false;
  await history.load();
  await history.waitForSaves();
  assert.deepEqual(
    new Set(parseOrderHistory(storage.raw()).map((e) => e.id)),
    new Set(['old', 'new']),
  );
});

test('failed saves retain activity, expose retry and clear error after a successful write', async () => {
  const storage = memoryStorage();
  const history = createOrderHistoryStore(storage, 'session');
  await history.load();
  storage.failWrite = true;
  history.record(fill());
  await history.waitForSaves();
  assert.match(history.getSnapshot().error, /could not be saved/);
  assert.equal(history.getSnapshot().saving, false);
  storage.failWrite = false;
  history.retry();
  await history.waitForSaves();
  assert.equal(history.getSnapshot().error, undefined);
  assert.equal(parseOrderHistory(storage.raw()).length, 1);
});

test('writes serialize so a slow pending save cannot overwrite a newer cancelled record', async () => {
  const storage = memoryStorage();
  let release;
  let calls = 0;
  const originalWrite = storage.setItem.bind(storage);
  storage.setItem = async (key, value) => {
    calls++;
    if (calls === 1)
      await new Promise((resolve) => {
        release = resolve;
      });
    await originalWrite(key, value);
  };
  const history = createOrderHistoryStore(storage, 'session');
  await history.load();
  history.record(pending());
  await flush();
  history.record({
    ...pending(),
    updatedAt: 1200,
    order: { ...pending().order, status: 'cancelled' },
  });
  assert.equal(calls, 1);
  release();
  await history.waitForSaves();
  assert.equal(calls, 2);
  assert.equal(parseOrderHistory(storage.raw())[0].status, 'cancelled');
});

test('storage validation rejects bad versions, duplicate IDs, invalid quantities and inconsistent fills', async () => {
  const storage = memoryStorage();
  const history = createOrderHistoryStore(storage, 'session');
  await history.load();
  history.record(fill());
  await history.waitForSaves();
  const entry = parseOrderHistory(storage.raw())[0];
  assert.deepEqual(parseOrderHistory(null), []);
  for (const raw of [
    '[]',
    '{"version":2,"entries":[]}',
    JSON.stringify({ version: 1, entries: [entry, entry] }),
  ])
    assert.throws(() => parseOrderHistory(raw));
  for (const patch of [
    { quantity: 0 },
    { quantity: 1.5 },
    { side: 'short' },
    { status: 'made-up' },
    { pricePaise: 0 },
    { valuePaise: 1 },
    { filledAt: -1 },
    { symbol: '' },
    { type: 'limit', limitPricePaise: -1 },
  ]) {
    assert.throws(() =>
      parseOrderHistory(
        JSON.stringify({ version: 1, entries: [{ ...entry, ...patch }] }),
      ),
    );
  }
});

test('history records terminal execution rejection and never fabricates a failed market fill', async () => {
  const storage = memoryStorage();
  const history = createOrderHistoryStore(storage, 'session');
  await history.load();
  const trades = createTradingStore(
    [{ symbol: 'TCS', qty: 1, avgPricePaise: Number.MAX_SAFE_INTEGER }],
    (symbol) => ({ symbol, seq: 0 }),
    ['TCS'],
    () => 1000,
    history.record,
  );
  assert.equal(
    trades.submit({ id: 'bad-market', symbol: 'TCS', side: 'buy', quantity: 1 }).ok,
    false,
  );
  trades.placeLimit({
    id: 'rejected-limit',
    symbol: 'TCS',
    side: 'buy',
    quantity: 1,
    limitPricePaise: 100,
  });
  trades.processPriceTick('TCS', 100);
  await history.waitForSaves();
  const entries = parseOrderHistory(storage.raw());
  assert.equal(entries.length, 1);
  assert.equal(entries[0].status, 'rejected');
  assert.match(entries[0].error, /too large/);
  assert.equal(entries[0].pricePaise, undefined);
});
