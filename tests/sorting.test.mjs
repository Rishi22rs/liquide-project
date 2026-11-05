import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortHoldings } from '../src/domain/portfolio.ts';

const holdings = [
  { symbol: 'OLDCO', qty: 1, avgPricePaise: 100 },
  { symbol: 'B', qty: 2, avgPricePaise: 100 },
  { symbol: 'A', qty: 1, avgPricePaise: 500 },
  { symbol: 'ZERO', qty: 1, avgPricePaise: 100 },
];
const quotes = {
  A: { symbol: 'A', seq: 1, ltp: 300 },
  B: { symbol: 'B', seq: 1, ltp: 200 },
  ZERO: { symbol: 'ZERO', seq: 1, ltp: 0 },
};
const symbols = (values) => values.map((holding) => holding.symbol);

test('name sorting works both ways without prices and preserves source order', () => {
  const original = [...holdings];
  assert.deepEqual(symbols(sortHoldings(holdings, {}, 'name', 'ascending')), [
    'A',
    'B',
    'OLDCO',
    'ZERO',
  ]);
  assert.deepEqual(symbols(sortHoldings(holdings, {}, 'name', 'descending')), [
    'ZERO',
    'OLDCO',
    'B',
    'A',
  ]);
  assert.deepEqual(holdings, original);
});
test('value sorts quantity times price, including zero, with missing quotes last', () => {
  assert.deepEqual(symbols(sortHoldings(holdings, quotes, 'value', 'descending')), [
    'B',
    'A',
    'ZERO',
    'OLDCO',
  ]);
  assert.deepEqual(symbols(sortHoldings(holdings, quotes, 'value', 'ascending')), [
    'ZERO',
    'A',
    'B',
    'OLDCO',
  ]);
});
test('P&L sorts rupee gains and losses, not price or percentage', () => {
  assert.deepEqual(symbols(sortHoldings(holdings, quotes, 'pnl', 'descending')), [
    'B',
    'ZERO',
    'A',
    'OLDCO',
  ]);
  assert.deepEqual(symbols(sortHoldings(holdings, quotes, 'pnl', 'ascending')), [
    'A',
    'ZERO',
    'B',
    'OLDCO',
  ]);
});
test('ties and unavailable prices use deterministic alphabetical ordering', () => {
  const equalQuotes = {
    A: { symbol: 'A', seq: 1, ltp: 400 },
    B: { symbol: 'B', seq: 1, ltp: 200 },
  };
  assert.deepEqual(symbols(sortHoldings(holdings, equalQuotes, 'value', 'descending')), [
    'A',
    'B',
    'OLDCO',
    'ZERO',
  ]);
  assert.deepEqual(symbols(sortHoldings(holdings, {}, 'pnl', 'descending')), [
    'A',
    'B',
    'OLDCO',
    'ZERO',
  ]);
  assert.deepEqual(sortHoldings([], {}, 'value', 'ascending'), []);
});
test('price updates change numeric ranking while retaining holding objects', () => {
  const updatedQuotes = { ...quotes, A: { ...quotes.A, seq: 2, ltp: 900 } };
  const before = sortHoldings(holdings, quotes, 'value', 'descending');
  const after = sortHoldings(holdings, updatedQuotes, 'value', 'descending');
  assert.equal(before[0].symbol, 'B');
  assert.equal(after[0].symbol, 'A');
  assert.equal(after[0], holdings[2]);
});
