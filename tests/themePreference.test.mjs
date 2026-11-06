import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createThemePreference } from '../src/domain/themePreference.ts';

test('theme toggles globally and restores the last saved choice after restart', async () => {
  let saved = null;
  const storage = {
    getItem: async () => saved,
    setItem: async (_key, value) => {
      saved = value;
    },
  };
  const first = createThemePreference(storage);
  await first.load();
  assert.equal(first.getSnapshot(), 'dark');
  let changes = 0;
  first.subscribe(() => changes++);
  first.toggle();
  assert.equal(first.getSnapshot(), 'light');
  await first.waitForSaves();
  assert.equal(changes, 1);
  const second = createThemePreference(storage);
  await second.load();
  assert.equal(second.getSnapshot(), 'light');
});

test('a selection before or during hydration wins over an old saved preference', async () => {
  let resolve;
  const during = createThemePreference({
    getItem: () =>
      new Promise((done) => {
        resolve = done;
      }),
    setItem: async () => {},
  });
  const loading = during.load();
  during.toggle();
  resolve('dark');
  await loading;
  assert.equal(during.getSnapshot(), 'light');
  const before = createThemePreference({
    getItem: async () => 'dark',
    setItem: async () => {},
  });
  before.toggle();
  await before.load();
  assert.equal(before.getSnapshot(), 'light');
});

test('rapid toggles serialize writes, with the latest selection saved last', async () => {
  let release;
  const writes = [];
  const preference = createThemePreference({
    getItem: async () => null,
    setItem: async (_key, value) => {
      if (!writes.length) {
        writes.push(value);
        await new Promise((done) => {
          release = done;
        });
      } else writes.push(value);
    },
  });
  preference.toggle();
  await Promise.resolve();
  preference.toggle();
  preference.toggle();
  assert.deepEqual(writes, ['light']);
  release();
  await preference.waitForSaves();
  assert.deepEqual(writes, ['light', 'dark', 'light']);
});

test('invalid saved preferences and storage errors never break the switch', async () => {
  const bad = createThemePreference({
    getItem: async () => 'purple',
    setItem: async () => {
      throw new Error('offline storage');
    },
  });
  await bad.load();
  assert.equal(bad.getSnapshot(), 'dark');
  bad.toggle();
  await bad.waitForSaves();
  assert.equal(bad.getSnapshot(), 'light');
  const failedRead = createThemePreference({
    getItem: async () => {
      throw new Error('read failed');
    },
    setItem: async () => {},
  });
  await failedRead.load();
  failedRead.toggle();
  assert.equal(failedRead.getSnapshot(), 'light');
});
