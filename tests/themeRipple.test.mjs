import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rippleGeometry } from '../src/domain/themeRipple.ts';
import { createThemePreference } from '../src/domain/themePreference.ts';

test('a ripple from the header bubble reaches every corner of a phone screen', () => {
  const { x, y, radius } = rippleGeometry({ x: 328, y: 76 }, 390, 844);
  for (const [cornerX, cornerY] of [
    [0, 0],
    [390, 0],
    [0, 844],
    [390, 844],
  ])
    assert.ok(radius > Math.hypot(cornerX - x, cornerY - y));
});
test('ripple origins stay inside the measured surface on either screen edge', () => {
  assert.deepEqual(rippleGeometry({ x: -10, y: 900 }, 390, 844), {
    x: 0,
    y: 844,
    radius: Math.hypot(390, 844) + 2,
  });
  assert.deepEqual(rippleGeometry({ x: 999, y: -5 }, 390, 844), {
    x: 390,
    y: 0,
    radius: Math.hypot(390, 844) + 2,
  });
});
test('the captured target is selected exactly once even if startup restores a preference meanwhile', async () => {
  let finish;
  const preference = createThemePreference({
    getItem: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    setItem: async () => {},
  });
  const loading = preference.load();
  const target = preference.getSnapshot() === 'dark' ? 'light' : 'dark';
  finish('light');
  await loading;
  preference.select(target);
  assert.equal(preference.getSnapshot(), 'light');
});
