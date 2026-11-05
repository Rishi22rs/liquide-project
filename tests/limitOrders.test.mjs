import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTradingStore, parseLimitPrice } from '../src/domain/trading.ts';
const holding = { symbol: 'TCS', qty: 10, avgPricePaise: 10000 };
const request = (id, side = 'buy', quantity = 2, limitPricePaise = 9500) => ({
  id,
  symbol: 'TCS',
  side,
  quantity,
  limitPricePaise,
});
const store = (holdings = [holding]) =>
  createTradingStore(
    holdings,
    (symbol) => ({ symbol, seq: 10, ltp: 10000 }),
    ['TCS', 'INFY'],
    () => 1234,
  );

test('limit rupee parsing is exact, positive, bounded and rejects excess decimals', () => {
  assert.equal(parseLimitPrice('1319.59'), 131959);
  assert.equal(parseLimitPrice(' 0.01 '), 1);
  assert.equal(parseLimitPrice('001.2'), 120);
  assert.equal(parseLimitPrice('90071992547409.91'), Number.MAX_SAFE_INTEGER);
  for (const value of [
    '',
    '0',
    '-1',
    '1.005',
    '1e3',
    '1,000',
    'NaN',
    '90071992547409.92',
    '9'.repeat(1000),
  ])
    assert.equal(parseLimitPrice(value), undefined);
});

test('placement is pending, idempotent and does not execute against a REST quote', () => {
  const s = store();
  const before = s.getSnapshot();
  const order = s.placeLimit(request('one', 'buy', 2, 11000));
  assert.equal(order.ok, true);
  assert.equal(order.order.status, 'pending');
  assert.equal(s.getSnapshot(), before);
  assert.equal(s.placeLimit(request('one', 'buy', 2, 11000)).order, order.order);
  assert.equal(s.placeLimit(request('one', 'buy', 3, 11000)).ok, false);
  assert.equal(s.getOrdersSnapshot().length, 1);
});

test('buy limits wait above the limit and fill once at the exact or better received price', () => {
  const s = store();
  s.placeLimit(request('buy'));
  const pending = s.getOrdersSnapshot();
  s.processPriceTick('TCS', 9501);
  assert.equal(s.getOrdersSnapshot(), pending);
  s.processPriceTick('INFY', 9000);
  assert.equal(s.getOrdersSnapshot(), pending);
  s.processPriceTick('TCS', 9400);
  const order = s.getOrdersSnapshot()[0];
  assert.equal(order.status, 'filled');
  assert.equal(order.fill.pricePaise, 9400);
  assert.equal(order.fill.valuePaise, 18800);
  assert.equal(order.fill.filledAt, 1234);
  assert.equal(s.getSnapshot()[0].qty, 12);
  assert.equal(s.getSnapshot()[0].costBasisPaise, 118800);
  s.processPriceTick('TCS', 9000);
  assert.equal(s.getSnapshot()[0].qty, 12);
});

test('sell limits wait below the limit, fill on equality and preserve acquisition average', () => {
  const s = store();
  s.placeLimit(request('sell', 'sell', 3, 10500));
  s.processPriceTick('TCS', 10499);
  assert.equal(s.getOrdersSnapshot()[0].status, 'pending');
  s.processPriceTick('TCS', 10500);
  assert.equal(s.getOrdersSnapshot()[0].fill.pricePaise, 10500);
  assert.equal(s.getSnapshot()[0].qty, 7);
  assert.equal(s.getSnapshot()[0].avgPricePaise, 10000);
});

test('pending sell reservations prevent conflicting market and limit sells; cancel releases them', () => {
  const s = store();
  s.placeLimit(request('sell', 'sell', 7, 10500));
  assert.equal(s.availableToSell('TCS'), 3);
  assert.equal(s.placeLimit(request('other', 'sell', 4, 11000)).ok, false);
  assert.equal(
    s.submit({ id: 'market', symbol: 'TCS', side: 'sell', quantity: 4 }).ok,
    false,
  );
  assert.equal(
    s.submit({ id: 'market', symbol: 'TCS', side: 'sell', quantity: 3 }).ok,
    true,
  );
  assert.equal(s.availableToSell('TCS'), 0);
  assert.equal(s.cancelLimit('sell'), true);
  assert.equal(s.availableToSell('TCS'), 7);
  assert.equal(s.cancelLimit('sell'), false);
  s.processPriceTick('TCS', 12000);
  assert.equal(s.getSnapshot()[0].qty, 7);
});

test('multiple pending sells fill FIFO without double-reserving or overselling', () => {
  const s = store();
  s.placeLimit(request('first', 'sell', 6, 10500));
  s.placeLimit(request('second', 'sell', 4, 10500));
  const observations = [];
  s.subscribe(() =>
    observations.push({ holdings: s.getSnapshot(), orders: s.getOrdersSnapshot() }),
  );
  s.processPriceTick('TCS', 11000);
  assert.equal(s.getSnapshot().length, 0);
  assert.deepEqual(
    s.getOrdersSnapshot().map((order) => order.fill.remainingQuantity),
    [4, 0],
  );
  assert.equal(observations.length, 1);
  assert.ok(observations[0].orders.every((order) => order.status === 'filled'));
  assert.equal(s.cancelLimit('first'), false);
});

test('invalid prices never trigger an order and pending matching publishes no notifications', () => {
  const s = store();
  s.placeLimit(request('buy'));
  let notifications = 0;
  s.subscribeOrders(() => notifications++);
  for (const price of [undefined, NaN, Infinity, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
    s.processPriceTick('TCS', price);
  s.processPriceTick('TCS', 10000);
  assert.equal(notifications, 0);
  assert.equal(s.getSnapshot()[0].qty, 10);
});

test('invalid quantities, prices, symbols and reused market IDs cannot place orders', () => {
  const s = store();
  for (const quantity of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER])
    assert.equal(s.placeLimit(request('bad', 'buy', quantity)).ok, false);
  for (const price of [0, -1, NaN, 1.5, Infinity])
    assert.equal(s.placeLimit(request('bad', 'buy', 1, price)).ok, false);
  assert.equal(s.placeLimit({ ...request('unknown'), symbol: 'NOPE' }).ok, false);
  assert.equal(s.placeLimit(request('over', 'sell', 11)).ok, false);
  s.submit({ id: 'market', symbol: 'TCS', side: 'buy', quantity: 1 });
  assert.equal(s.placeLimit(request('market')).ok, false);
  s.placeLimit(request('limit'));
  assert.equal(
    s.submit({ id: 'limit', symbol: 'TCS', side: 'buy', quantity: 2 }).ok,
    false,
  );
});

test('unsafe fill is rejected once without changing positions or retrying every tick', () => {
  const huge = { symbol: 'TCS', qty: 1, avgPricePaise: Number.MAX_SAFE_INTEGER };
  const s = store([huge]);
  s.placeLimit(request('overflow', 'buy', 1, 100));
  const before = s.getSnapshot();
  s.processPriceTick('TCS', 100);
  assert.equal(s.getOrdersSnapshot()[0].status, 'rejected');
  assert.match(s.getOrdersSnapshot()[0].error, /too large/);
  assert.equal(s.getSnapshot(), before);
  const rejected = s.getOrdersSnapshot();
  s.processPriceTick('TCS', 99);
  assert.equal(s.getOrdersSnapshot(), rejected);
});

test('a pending order creates a new position and cannot be replayed after cancellation', () => {
  const s = store([]);
  s.placeLimit(request('new', 'buy', 1, 100));
  s.processPriceTick('TCS', 100);
  assert.equal(s.getSnapshot()[0].qty, 1);
  s.placeLimit(request('cancel'));
  s.cancelLimit('cancel');
  assert.equal(s.placeLimit(request('cancel')).order.status, 'cancelled');
  s.processPriceTick('TCS', 100);
  assert.equal(s.getSnapshot()[0].qty, 1);
});
