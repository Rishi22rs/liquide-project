import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeTick,
  position,
  summarize,
  toPaise,
  money,
} from '../src/domain/portfolio.ts';
test('converts decimal API prices to integer paise', () => {
  assert.equal(toPaise(1319.59), 131959);
  assert.equal(toPaise(1.005), 101);
  assert.throws(() => toPaise(NaN));
});
test('late and duplicate ticks preserve the same quote reference', () => {
  const quote = { symbol: 'TCS', seq: 8, ltp: 10000, high: 11000 };
  assert.equal(mergeTick(quote, { symbol: 'TCS', seq: 7, ltp: 1 }), quote);
  assert.equal(mergeTick(quote, { symbol: 'TCS', seq: 8, ltp: 1 }), quote);
});
test('partial ticks preserve prices; malformed fields cannot erase them', () => {
  const quote = { symbol: 'TCS', seq: 8, ltp: 10000, high: 11000 };
  assert.deepEqual(mergeTick(quote, { symbol: 'TCS', seq: 9, volume: 42 }), {
    ...quote,
    seq: 9,
    volume: 42,
  });
  assert.equal(mergeTick(quote, { symbol: 'TCS', seq: 9, ltp: NaN }).ltp, 10000);
  assert.equal(mergeTick(undefined, { symbol: 'OLDCO', seq: 1, ltp: 100 }), undefined);
});
test('missing price never becomes zero, while cost basis remains known', () => {
  const row = position({ symbol: 'OLDCO', qty: 30, avgPricePaise: 41250 });
  assert.equal(row.invested, 1237500);
  assert.equal(row.value, undefined);
  assert.equal(row.pnl, undefined);
  assert.equal(money(row.value), '--');
});
test('summary reconciles rows and excludes missing holdings from P&L denominator', () => {
  const holdings = [
    { symbol: 'A', qty: 3, avgPricePaise: 101 },
    { symbol: 'B', qty: 2, avgPricePaise: 200 },
    { symbol: 'OLDCO', qty: 1, avgPricePaise: 900 },
  ];
  const quotes = {
    A: { symbol: 'A', seq: 1, ltp: 110, prevClose: 105 },
    B: { symbol: 'B', seq: 1, ltp: 190, prevClose: 200 },
  };
  const s = summarize(holdings, quotes);
  assert.equal(s.invested, 1603);
  assert.equal(s.value, 710);
  assert.equal(s.pnl, 7);
  assert.equal(s.dayPnl, -5);
  assert.equal(s.missing, 1);
  assert.equal(s.pnlPercent, (7 / 703) * 100);
  assert.equal(
    s.value,
    holdings.reduce((sum, h) => sum + (position(h, quotes[h.symbol]).value ?? 0), 0),
  );
});
test('zero previous close yields no percentage instead of infinity', () => {
  const s = summarize([{ symbol: 'A', qty: 1, avgPricePaise: 100 }], {
    A: { symbol: 'A', seq: 1, ltp: 100, prevClose: 0 },
  });
  assert.equal(s.dayPercent, undefined);
});
