import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTrade,
  createTradingStore,
  parseTradeQuantity,
  validateTrade,
} from '../src/domain/trading.ts';
import { position, summarize } from '../src/domain/portfolio.ts';

const initial = { symbol: 'TCS', qty: 2, avgPricePaise: 100 };
const quote = (price) => ({ symbol: 'TCS', seq: 1, ltp: price, prevClose: 100 });
const request = (id, side = 'buy', quantity = 1, symbol = 'TCS') => ({
  id,
  symbol,
  side,
  quantity,
});

test('quantity parsing accepts whole positive numbers without truncating invalid input', () => {
  assert.equal(parseTradeQuantity(' 003 '), 3);
  for (const value of ['', '0', '-1', '1.2', '1e2', '0x10', 'two', '9007199254740992']) {
    assert.equal(parseTradeQuantity(value), undefined, value);
  }
});
test('buy computes weighted average from exact cost basis and leaves the input untouched', () => {
  const updated = calculateTrade(initial, 'TCS', 'buy', 1, 101);
  assert.equal(updated.qty, 3);
  assert.equal(updated.costBasisPaise, 301);
  assert.equal(updated.avgPricePaise, 301 / 3);
  assert.deepEqual(initial, { symbol: 'TCS', qty: 2, avgPricePaise: 100 });
});
test('repeated buys do not rebuild cost basis from a rounded average', () => {
  const first = calculateTrade(initial, 'TCS', 'buy', 1, 101);
  const second = calculateTrade(first, 'TCS', 'buy', 2, 103);
  assert.equal(second.costBasisPaise, 507);
  assert.equal(second.avgPricePaise, 101.4);
  assert.equal(position(second, quote(103)).invested, 507);
});
test('partial sell preserves average price and deliberately allocates cost to paise', () => {
  const holding = { symbol: 'TCS', qty: 3, avgPricePaise: 301 / 3, costBasisPaise: 301 };
  const remaining = calculateTrade(holding, 'TCS', 'sell', 1, 110);
  assert.equal(remaining.qty, 2);
  assert.equal(remaining.avgPricePaise, holding.avgPricePaise);
  assert.equal(remaining.costBasisPaise, 201);
  assert.equal(position(remaining, quote(110)).pnl, 19);
});
test('sale allocation rounds half-paise ties correctly even near the safe integer limit', () => {
  const tiny = calculateTrade(
    { symbol: 'TCS', qty: 2, avgPricePaise: 1.5, costBasisPaise: 3 },
    'TCS',
    'sell',
    1,
    1,
  );
  assert.equal(tiny.costBasisPaise, 2);
  const large = calculateTrade(
    {
      symbol: 'TCS',
      qty: 3,
      avgPricePaise: Number.MAX_SAFE_INTEGER / 3,
      costBasisPaise: Number.MAX_SAFE_INTEGER,
    },
    'TCS',
    'sell',
    1,
    1,
  );
  assert.equal(large.costBasisPaise, 6004799503160661);
});
test('selling the complete position removes it', () => {
  assert.equal(calculateTrade(initial, 'TCS', 'sell', 2, 120), undefined);
});
test('overselling, invalid quantity and unavailable/non-positive prices are rejected', () => {
  assert.match(validateTrade('sell', 3, initial, 100), /up to 2/);
  assert.match(validateTrade('sell', 1, undefined, 100), /up to 0/);
  for (const qty of [0, -1, 1.5, NaN, undefined])
    assert.ok(validateTrade('buy', qty, initial, 100));
  for (const price of [undefined, 0, -1, NaN, 100.5])
    assert.ok(validateTrade('buy', 1, initial, price));
});
test('unsafe order values are rejected before arithmetic can lose money precision', () => {
  assert.ok(validateTrade('buy', Number.MAX_SAFE_INTEGER, initial, 100));
  assert.throws(() =>
    calculateTrade(
      { symbol: 'TCS', qty: 1, avgPricePaise: Number.MAX_SAFE_INTEGER },
      'TCS',
      'buy',
      1,
      100,
    ),
  );
});
test('confirmation fills using the latest quote, not an earlier displayed estimate', () => {
  let price = 100;
  const store = createTradingStore(
    [initial],
    () => quote(price),
    ['TCS'],
    () => 1234,
  );
  const earlierEstimate = price;
  price = 110;
  const result = store.submit(request('first'));
  assert.equal(result.ok, true);
  assert.notEqual(result.fill.pricePaise, earlierEstimate);
  assert.equal(result.fill.pricePaise, 110);
  assert.equal(result.fill.valuePaise, 110);
  assert.equal(result.fill.filledAt, 1234);
  assert.equal(store.getSnapshot()[0].costBasisPaise, 310);
});
test('one trade publishes one complete holdings snapshot', () => {
  const store = createTradingStore([initial], () => quote(110), ['TCS']);
  const observed = [];
  store.subscribe(() => observed.push(store.getSnapshot()));
  store.submit(request('one'));
  assert.equal(observed.length, 1);
  assert.equal(observed[0][0].qty, 3);
  assert.equal(observed[0][0].costBasisPaise, 310);
});
test('repeating a confirmed request does not execute a second order', () => {
  const store = createTradingStore([initial], () => quote(110), ['TCS']);
  const first = store.submit(request('same'));
  const snapshot = store.getSnapshot();
  const second = store.submit(request('same'));
  assert.equal(second.fill, first.fill);
  assert.equal(store.getSnapshot(), snapshot);
  assert.equal(store.getSnapshot()[0].qty, 3);
  assert.equal(store.submit(request('same', 'buy', 2)).ok, false);
});
test('a failed order preserves snapshot identity and can be corrected before retry', () => {
  const store = createTradingStore([initial], () => quote(110), ['TCS']);
  const snapshot = store.getSnapshot();
  assert.equal(store.submit(request('sell', 'sell', 3)).ok, false);
  assert.equal(store.getSnapshot(), snapshot);
  assert.equal(store.submit(request('sell', 'sell', 1)).ok, true);
});
test('unrelated positions retain reference identity after a fill', () => {
  const other = { symbol: 'INFY', qty: 1, avgPricePaise: 100 };
  const store = createTradingStore([initial, other], () => quote(110), ['TCS', 'INFY']);
  store.submit(request('one'));
  assert.equal(store.getSnapshot()[1], other);
});
test('buying a new stock and rebuying after a full sale starts a new average', () => {
  const store = createTradingStore([], () => quote(150), ['TCS']);
  assert.equal(store.submit(request('buy')).ok, true);
  assert.equal(store.getSnapshot()[0].avgPricePaise, 150);
  store.submit(request('sell', 'sell'));
  assert.deepEqual(store.getSnapshot(), []);
  store.submit(request('again', 'buy', 2));
  assert.equal(store.getSnapshot()[0].qty, 2);
  assert.equal(store.getSnapshot()[0].avgPricePaise, 150);
});
test('missing/wrong-symbol quotes and unknown symbols cannot fill', () => {
  const missing = createTradingStore([initial], () => undefined, ['TCS']);
  assert.equal(missing.submit(request('missing')).ok, false);
  const wrong = createTradingStore(
    [initial],
    () => ({ symbol: 'INFY', seq: 1, ltp: 100 }),
    ['TCS'],
  );
  assert.equal(wrong.submit(request('wrong')).ok, false);
  assert.equal(missing.submit(request('unknown', 'buy', 1, 'FAKE')).ok, false);
});
test('summary reconciles row amounts after buys and sells, including missing prices', () => {
  const old = { symbol: 'OLDCO', qty: 1, avgPricePaise: 500 };
  const quotes = { TCS: quote(110) };
  const store = createTradingStore([initial, old], (symbol) => quotes[symbol], ['TCS']);
  store.submit(request('buy', 'buy', 3));
  store.submit(request('sell', 'sell', 1));
  const holdings = store.getSnapshot();
  const summary = summarize(holdings, quotes);
  assert.equal(
    summary.invested,
    holdings.reduce((sum, h) => sum + position(h, quotes[h.symbol]).invested, 0),
  );
  assert.equal(
    summary.value,
    holdings.reduce((sum, h) => sum + (position(h, quotes[h.symbol]).value ?? 0), 0),
  );
  assert.equal(
    summary.pnl,
    holdings.reduce((sum, h) => sum + (position(h, quotes[h.symbol]).pnl ?? 0), 0),
  );
  assert.equal(summary.missing, 1);
});
