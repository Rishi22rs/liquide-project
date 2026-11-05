import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTickChart,
  createTickHistory,
  sampleChartPoints,
} from '../src/domain/tickHistory.ts';

const point = (price, receivedAt) => ({ price, receivedAt });

test('new detail sessions start empty, independent of previous screen sessions', () => {
  const first = createTickHistory('TCS');
  assert.deepEqual(first.getSnapshot(), []);
  first.append({ symbol: 'TCS', price: 10000, receivedAt: 1000 });
  assert.equal(first.getSnapshot().length, 1);
  assert.deepEqual(createTickHistory('TCS').getSnapshot(), []);
  assert.equal(buildTickChart([]), undefined);
});
test('history ignores other stocks and invalid prices without publishing a snapshot', () => {
  const history = createTickHistory('TCS');
  const initial = history.getSnapshot();
  history.append({ symbol: 'INFY', price: 100, receivedAt: 1 });
  history.append({ symbol: 'TCS', price: NaN, receivedAt: 1 });
  history.append({ symbol: 'TCS', price: -1, receivedAt: 1 });
  history.append({ symbol: 'TCS', price: 100.5, receivedAt: 1 });
  assert.equal(history.getSnapshot(), initial);
});
test('rapid ticks are all retained; unsubscribing stops notifications', () => {
  const history = createTickHistory('TCS');
  let notifications = 0;
  const unsubscribe = history.subscribe(() => notifications++);
  for (let i = 0; i < 10; i++)
    history.append({ symbol: 'TCS', price: 100 + i, receivedAt: i * 50 });
  assert.equal(history.getSnapshot().length, 10);
  assert.equal(notifications, 10);
  unsubscribe();
  history.append({ symbol: 'TCS', price: 110, receivedAt: 500 });
  assert.equal(notifications, 10);
});
test('single/constant prices render without division by zero or invented movement', () => {
  const single = buildTickChart([point(100, 1)]);
  assert.deepEqual(single.end, { x: 160, y: 90 });
  const flat = buildTickChart([point(100, 1), point(100, 2)]);
  assert.equal(flat.minimum, 100);
  assert.equal(flat.maximum, 100);
  assert.equal(flat.end.y, 90);
  assert.ok(!flat.line.includes('NaN'));
});
test('chart coordinates use receipt times and full-session price range', () => {
  const chart = buildTickChart([point(100, 0), point(200, 25), point(300, 100)]);
  assert.equal(chart.line, 'M10.00,170.00 L85.00,90.00 L310.00,10.00');
  assert.equal(chart.minimum, 100);
  assert.equal(chart.maximum, 300);
  assert.equal(chart.last.price, 300);
});
test('equal timestamp ticks remain finite and ordered', () => {
  const chart = buildTickChart([point(300, 1), point(200, 1), point(100, 1)]);
  assert.equal(chart.line, 'M10.00,10.00 L160.00,90.00 L310.00,170.00');
});
test('downsampling bounds rendering while preserving endpoints, extrema and real points', () => {
  const points = Array.from({ length: 1000 }, (_, index) => point(1000 + index, index));
  points[199] = point(99999, 199);
  points[401] = point(1, 401);
  const sampled = sampleChartPoints(points);
  assert.ok(sampled.length <= 240);
  assert.equal(sampled[0], points[0]);
  assert.equal(sampled.at(-1), points.at(-1));
  assert.ok(sampled.includes(points[199]));
  assert.ok(sampled.includes(points[401]));
  assert.ok(
    sampled.every(
      (p, i) =>
        points.includes(p) && (i === 0 || p.receivedAt > sampled[i - 1].receivedAt),
    ),
  );
  const chart = buildTickChart(points);
  assert.equal(chart.minimum, 1);
  assert.equal(chart.maximum, 99999);
  assert.equal(points.length, 1000);
});
