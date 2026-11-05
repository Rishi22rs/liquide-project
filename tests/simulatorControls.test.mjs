import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSimulator } from '../src/feed/simulator.ts';
import { createReconnectingFeed } from '../src/feed/reconnectingFeed.ts';
const seed = { TCS: { symbol: 'TCS', seq: 0, ltp: 10000 } };
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
function clock(t) {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1000 });
  t.mock.method(Math, 'random', () => 0.5);
}

test('tick rate changes immediately without duplicate timers or resetting per-symbol sequences', (t) => {
  clock(t);
  const feed = createSimulator(seed);
  const ticks = [];
  feed.onTick((tick) => ticks.push(tick));
  feed.connect();
  t.mock.timers.tick(1000);
  assert.equal(ticks.length, 20);
  assert.equal(feed.setTickRate(5), true);
  t.mock.timers.tick(1000);
  assert.equal(ticks.length, 25);
  assert.equal(feed.setTickRate(100), true);
  t.mock.timers.tick(1000);
  assert.equal(ticks.length, 125);
  assert.equal(ticks.at(-1).seq, 125);
  assert.equal(ticks.at(-1).ltp, seed.TCS.ltp);
  feed.disconnect();
  t.mock.timers.tick(1000);
  assert.equal(ticks.length, 125);
  assert.equal(feed.isConnected(), false);
});

test('invalid rates leave the running cadence unchanged and invalid initial rates use twenty', (t) => {
  clock(t);
  const feed = createSimulator(seed, NaN);
  let count = 0;
  feed.onTick(() => count++);
  feed.connect();
  for (const rate of [0, -1, 101, 1.5, NaN, Infinity])
    assert.equal(feed.setTickRate(rate), false);
  t.mock.timers.tick(1000);
  assert.equal(count, 20);
  assert.equal(feed.setTickRate(20), true);
  t.mock.timers.tick(1000);
  assert.equal(count, 40);
  feed.disconnect();
});

test('forced outage emits one disconnect and lasts five seconds despite rate changes or repeated clicks', (t) => {
  clock(t);
  const feed = createSimulator(seed);
  let count = 0;
  let drops = 0;
  feed.onTick(() => count++);
  feed.onDisconnect(() => drops++);
  assert.equal(feed.forceDisconnect(), false);
  feed.connect();
  t.mock.timers.tick(100);
  const before = count;
  assert.equal(feed.forceDisconnect(), true);
  assert.equal(drops, 1);
  assert.equal(feed.forceDisconnect(), false);
  assert.equal(feed.isConnected(), false);
  feed.setTickRate(5);
  t.mock.timers.tick(4999);
  assert.equal(count, before);
  assert.throws(() => feed.connect(), /unavailable/);
  t.mock.timers.tick(1);
  feed.connect();
  t.mock.timers.tick(1000);
  assert.equal(count, before + 5);
  assert.equal(drops, 1);
  feed.disconnect();
});

test('changing cadence preserves the original minute boundary for scheduled pauses', (t) => {
  clock(t);
  const feed = createSimulator(seed);
  let drops = 0;
  feed.onDisconnect(() => drops++);
  feed.connect();
  t.mock.timers.tick(59000);
  feed.setTickRate(5);
  t.mock.timers.tick(1000);
  assert.equal(drops, 1);
  assert.equal(feed.isConnected(), false);
  feed.setTickRate(100);
  assert.equal(feed.isConnected(), false);
  assert.throws(() => feed.connect());
  feed.disconnect();
});

test('intentional disconnect and listener cleanup never simulate another network failure', (t) => {
  clock(t);
  const feed = createSimulator(seed);
  let drops = 0;
  const unsubscribe = feed.onDisconnect(() => drops++);
  feed.connect();
  feed.disconnect();
  assert.equal(drops, 0);
  feed.setTickRate(100);
  assert.equal(feed.isConnected(), false);
  unsubscribe();
  feed.connect();
  feed.forceDisconnect();
  assert.equal(drops, 0);
});

test('a forced disconnect exercises backoff/catch-up and the replacement feed keeps the chosen rate', async (t) => {
  clock(t);
  let rate = 20;
  let active;
  let fetches = 0;
  let ticks = 0;
  let state;
  const owner = createReconnectingFeed({
    fetchSnapshot: async () => {
      fetches++;
      return seed;
    },
    createFeed(snapshot) {
      active = createSimulator(snapshot, rate);
      return active;
    },
    onSnapshot() {},
    onTick() {
      ticks++;
    },
    onState(next) {
      state = next;
    },
  });
  await owner.start();
  const first = active;
  active.forceDisconnect();
  assert.equal(state.paused, true);
  rate = 100;
  active.setTickRate(rate);
  // No REST polling while transport is unavailable; probes at 1 and 3 seconds fail.
  for (let elapsed = 0; elapsed < 3000; elapsed += 50) {
    t.mock.timers.tick(50);
    await flush();
  }
  assert.equal(fetches, 1);
  assert.equal(ticks, 0);
  for (let elapsed = 0; elapsed < 4000; elapsed += 50) {
    t.mock.timers.tick(50);
    await flush();
  }
  assert.notEqual(active, first);
  assert.equal(fetches, 2);
  assert.equal(state.paused, false);
  const before = ticks;
  t.mock.timers.tick(1000);
  assert.equal(ticks - before, 100);
  owner.stop();
  const stopped = ticks;
  t.mock.timers.tick(1000);
  assert.equal(ticks, stopped);
});
