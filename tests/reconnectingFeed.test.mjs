import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReconnectingFeed, reconnectDelay } from '../src/feed/reconnectingFeed.ts';

const snapshot = (price = 10000) => ({ TCS: { symbol: 'TCS', seq: 0, ltp: price } });
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
function setup() {
  const tasks = [];
  const feeds = [];
  const states = [];
  const snapshots = [];
  const ticks = [];
  let fetches = 0;
  let fetcher = async () => snapshot();
  const owner = createReconnectingFeed({
    fetchSnapshot(signal) {
      fetches++;
      return fetcher(signal);
    },
    createFeed(seed) {
      const tickListeners = new Set();
      const closeListeners = new Set();
      const feed = {
        seed,
        fail: false,
        connects: 0,
        disconnects: 0,
        tickCallbacks: [],
        connect() {
          this.connects++;
          if (this.fail) throw new Error('Offline');
        },
        disconnect() {
          this.disconnects++;
        },
        onTick(handler) {
          tickListeners.add(handler);
          this.tickCallbacks.push(handler);
          return () => tickListeners.delete(handler);
        },
        onDisconnect(handler) {
          closeListeners.add(handler);
          return () => closeListeners.delete(handler);
        },
        drop() {
          for (const listener of [...closeListeners]) listener();
        },
        emit(tick) {
          for (const listener of tickListeners) listener(tick);
        },
      };
      feeds.push(feed);
      return feed;
    },
    onState: (state) => states.push(state),
    onSnapshot: (value) => snapshots.push(value),
    onTick: (value) => ticks.push(value),
    schedule(callback, delay) {
      const task = { callback, delay, cancelled: false };
      tasks.push(task);
      return () => {
        task.cancelled = true;
      };
    },
  });
  return {
    owner,
    tasks,
    feeds,
    states,
    snapshots,
    ticks,
    setFetch: (next) => {
      fetcher = next;
    },
    fetchCount: () => fetches,
    async runRetry() {
      const task = tasks.find((t) => !t.cancelled);
      assert.ok(task);
      task.cancelled = true;
      task.callback();
      await flush();
    },
  };
}

test('backoff grows exponentially and caps at thirty seconds', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 20].map(reconnectDelay),
    [1000, 2000, 4000, 8000, 16000, 30000, 30000],
  );
});

test('startup fetches once and shares one live feed without scheduling REST polling', async () => {
  const h = setup();
  await h.owner.start();
  assert.equal(h.fetchCount(), 1);
  assert.equal(h.tasks.length, 0);
  assert.equal(h.feeds.length, 1);
  h.feeds[0].emit({ symbol: 'TCS', seq: 1, ltp: 10010 });
  assert.equal(h.ticks.length, 1);
  assert.deepEqual(h.states.at(-1), { loading: false, paused: false });
  h.owner.stop();
});

test('offline probes back off without REST requests and catch up once on return', async () => {
  const h = setup();
  await h.owner.start();
  const old = h.feeds[0];
  old.fail = true;
  old.drop();
  h.owner.recover();
  h.owner.recover();
  assert.equal(h.tasks.length, 1);
  assert.equal(h.states.at(-1).paused, true);
  await h.runRetry();
  await h.runRetry();
  assert.equal(h.fetchCount(), 1);
  assert.deepEqual(
    h.tasks.map((t) => t.delay),
    [1000, 2000, 4000],
  );
  old.fail = false;
  h.setFetch(async () => snapshot(12000));
  await h.runRetry();
  assert.equal(h.fetchCount(), 2);
  assert.equal(h.feeds.length, 2);
  assert.equal(h.feeds[1].seed.TCS.ltp, 12000);
  assert.deepEqual(h.snapshots.at(-1), snapshot(12000));
  assert.deepEqual(h.states.at(-1), { loading: false, paused: false });
  old.tickCallbacks[0]({ symbol: 'TCS', seq: 999, ltp: 1 });
  assert.equal(h.ticks.length, 0);
  h.feeds[1].emit({ symbol: 'TCS', seq: 1, ltp: 12001 });
  assert.equal(h.ticks.length, 1);
  // A new outage begins a new backoff series.
  h.feeds[1].drop();
  assert.equal(h.tasks.at(-1).delay, 1000);
  h.owner.stop();
});

test('failed catch-up retains last snapshot, reports error and retries', async () => {
  const h = setup();
  await h.owner.start();
  h.feeds[0].drop();
  h.setFetch(async () => {
    throw new Error('REST unavailable');
  });
  await h.runRetry();
  assert.equal(h.snapshots.length, 1);
  assert.match(h.states.at(-1).error, /REST unavailable/);
  assert.equal(h.tasks.at(-1).delay, 2000);
  h.setFetch(async () => snapshot(11000));
  await h.runRetry();
  assert.equal(h.snapshots.at(-1).TCS.ltp, 11000);
  h.owner.stop();
});

test('stop cancels retry and aborts in-flight catch-up; late results cannot publish', async () => {
  const h = setup();
  await h.owner.start();
  h.feeds[0].drop();
  let finish;
  let requestSignal;
  h.setFetch((signal) => {
    requestSignal = signal;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  await h.runRetry();
  h.owner.stop();
  assert.equal(requestSignal.aborted, true);
  finish(snapshot(1));
  await flush();
  assert.equal(h.snapshots.length, 1);
  assert.equal(h.feeds.length, 1);
  const other = setup();
  await other.owner.start();
  other.feeds[0].drop();
  other.owner.stop();
  assert.equal(other.tasks[0].cancelled, true);
  // Even an already queued timer callback cannot revive a stopped connection.
  other.tasks[0].callback();
  await flush();
  assert.equal(other.fetchCount(), 1);
});

test('manual refresh supersedes pending reconnect and starts a new sequence epoch', async () => {
  const h = setup();
  await h.owner.start();
  h.feeds[0].drop();
  let finish;
  h.setFetch(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await h.runRetry();
  h.setFetch(async () => snapshot(13000));
  await h.owner.start();
  finish(snapshot(1));
  await flush();
  assert.equal(h.snapshots.at(-1).TCS.ltp, 13000);
  assert.equal(h.snapshots.length, 2);
  h.feeds.at(-1).emit({ symbol: 'TCS', seq: 1, ltp: 13001 });
  assert.equal(h.ticks.length, 1);
  h.owner.stop();
});

test('startup failures expose retry state without an automatic REST polling loop', async () => {
  const h = setup();
  h.setFetch(async () => {
    throw new Error('No network');
  });
  await h.owner.start();
  assert.equal(h.states.at(-1).paused, true);
  assert.match(h.states.at(-1).error, /No network/);
  assert.equal(h.tasks.length, 0);
  h.setFetch(async () => snapshot());
  await h.owner.start();
  assert.equal(h.states.at(-1).paused, false);
  h.owner.stop();
});

test('real simulator preserves its five-second outage across backoff probes', async (t) => {
  const { createSimulator } = await import('../src/feed/simulator.ts');
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 1000 });
  async function advance(milliseconds) {
    // Advance in tick-sized steps so Date.now and interval callbacks observe
    // the same clock, including timers scheduled by a disconnect callback.
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 50) {
      t.mock.timers.tick(50);
      await flush();
    }
  }
  let fetches = 0;
  let latestState;
  let acceptedTicks = 0;
  const owner = createReconnectingFeed({
    fetchSnapshot: async () => {
      fetches++;
      return snapshot();
    },
    createFeed: createSimulator,
    onSnapshot() {},
    onTick() {
      acceptedTicks++;
    },
    onState(state) {
      latestState = state;
    },
  });
  await owner.start();
  await advance(100);
  assert.ok(acceptedTicks > 0);
  await advance(59900);
  assert.equal(latestState.paused, true);
  const beforePause = acceptedTicks;
  await advance(1000);
  await flush();
  await advance(2000);
  await flush();
  assert.equal(fetches, 1);
  assert.equal(acceptedTicks, beforePause);
  await advance(4000);
  await flush();
  assert.equal(fetches, 2, JSON.stringify({ latestState, now: Date.now() }));
  assert.equal(latestState.paused, false);
  await advance(100);
  assert.ok(acceptedTicks > beforePause);
  owner.stop();
  const beforeStop = acceptedTicks;
  await advance(120000);
  await flush();
  assert.equal(acceptedTicks, beforeStop);
  assert.equal(fetches, 2);
});
