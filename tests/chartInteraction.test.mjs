import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chartTimeBounds,
  chartTouchFraction,
  nearestChartPoint,
  zoomChartWindow,
} from '../src/domain/chartInteraction.ts';
import {
  buildTickChart,
  chartPointCoordinate,
  sampleChartPoints,
} from '../src/domain/tickHistory.ts';

const bounds = { start: 0, end: 1000 };
const points = [
  { price: 10001, receivedAt: 0 },
  { price: 10199, receivedAt: 250 },
  { price: 10070, receivedAt: 700 },
  { price: 10200, receivedAt: 1000 },
];

test('pinch zooms around the midpoint and reverses without losing the domain', () => {
  const zoomed = zoomChartWindow(bounds, bounds, 2);
  assert.deepEqual(zoomed, { start: 250, end: 750 });
  assert.deepEqual(zoomChartWindow(bounds, zoomed, 0.5), bounds);
});
test('pinch preserves the focal time when its midpoint moves', () => {
  const current = { start: 250, end: 750 };
  const result = zoomChartWindow(bounds, current, 2, 0.25, 0.75);
  assert.equal(result.start + (result.end - result.start) * 0.75, 375);
});
test('zoom is limited to 16x and clamped at both ends of the session', () => {
  const left = zoomChartWindow(bounds, bounds, 1000, 0);
  const right = zoomChartWindow(bounds, bounds, 1000, 1);
  assert.deepEqual(left, { start: 0, end: 62.5 });
  assert.deepEqual(right, { start: 937.5, end: 1000 });
  assert.deepEqual(zoomChartWindow(bounds, right, 0.001), bounds);
});
test('single timestamp and invalid pinch scales stay finite', () => {
  assert.deepEqual(zoomChartWindow({ start: 3, end: 3 }, { start: 3, end: 3 }, 2), {
    start: 3,
    end: 3,
  });
  assert.deepEqual(zoomChartWindow(bounds, bounds, 0), bounds);
  assert.deepEqual(zoomChartWindow(bounds, bounds, NaN), bounds);
  assert.equal(chartTimeBounds([]), undefined);
});
test('drag selects the exact nearest recorded price, with earlier-tick ties', () => {
  assert.equal(nearestChartPoint(points, bounds, 0.3), points[1]);
  assert.equal(nearestChartPoint(points, bounds, 0.125), points[0]);
  assert.equal(nearestChartPoint(points, bounds, -1), points[0]);
  assert.equal(nearestChartPoint(points, bounds, 2), points[3]);
});
test('inspection searches raw ticks even when SVG downsampling omitted one', () => {
  const raw = Array.from({ length: 1000 }, (_, i) => ({
    price: 10000 + i,
    receivedAt: i,
  }));
  const sampled = sampleChartPoints(raw);
  const hidden = raw.find((point) => !sampled.includes(point));
  assert.ok(hidden);
  assert.equal(
    nearestChartPoint(raw, { start: 0, end: 999 }, hidden.receivedAt / 999),
    hidden,
  );
});
test('selection respects the zoom window and handles intervals without ticks', () => {
  assert.equal(nearestChartPoint(points, { start: 200, end: 800 }, 1), points[2]);
  assert.equal(nearestChartPoint(points, { start: 300, end: 600 }, 0.5), undefined);
  assert.equal(nearestChartPoint([], bounds, 0.5), undefined);
});
test('new live ticks cannot move a pinned inspection window or selected tick', () => {
  const window = { start: 0, end: 700 };
  const selected = nearestChartPoint(points, window, 1);
  const updated = [...points, { price: 99999, receivedAt: 2000 }];
  assert.equal(nearestChartPoint(updated, window, 1), selected);
});
test('touch coordinates account for SVG padding and actual frame width', () => {
  assert.equal(chartTouchFraction(10, 320), 0);
  assert.equal(chartTouchFraction(160, 320), 0.5);
  assert.equal(chartTouchFraction(310, 320), 1);
  assert.equal(chartTouchFraction(320, 640), 0.5);
  assert.equal(chartTouchFraction(-100, 320), 0);
  assert.equal(chartTouchFraction(10, 0), 0);
});
test('crosshair and graph share the same price/time coordinates in a zoomed window', () => {
  const chart = buildTickChart(points.slice(1, 3), 320, 180, { start: 200, end: 800 });
  const crosshair = chartPointCoordinate(points[1], chart.bounds);
  assert.equal(crosshair.x, 35);
  assert.equal(crosshair.y, 10);
  assert.ok(chart.line.startsWith('M35.00,10.00'));
});
