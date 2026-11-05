// Domain values use integer paise; undefined means unavailable, never zero.
export type Holding = Readonly<{ symbol: string; qty: number; avgPricePaise: number }>;
export type Quote = Readonly<{
  symbol: string;
  seq: number;
  ltp?: number;
  open?: number;
  high?: number;
  low?: number;
  prevClose?: number;
  volume?: number;
}>;
export type Tick = {
  symbol: string;
  seq: number;
  ltp?: number;
  high?: number;
  low?: number;
  volume?: number;
};

// All stored prices and displayed money amounts are integer paise.
export function toPaise(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees < 0) throw new Error('Invalid price');
  return Math.round((rupees + Number.EPSILON) * 100);
}
/** Merge only supplied fields. Old/duplicate sequences cannot overwrite newer data. */
export function mergeTick(previous: Quote | undefined, tick: Tick): Quote | undefined {
  if (
    !previous ||
    previous.symbol !== tick.symbol ||
    !Number.isSafeInteger(tick.seq) ||
    tick.seq <= previous.seq
  )
    return previous;
  const next = { ...previous, seq: tick.seq };
  for (const field of ['ltp', 'high', 'low', 'volume'] as const) {
    const value = tick[field];
    if (value !== undefined && Number.isSafeInteger(value) && value >= 0)
      next[field] = value;
  }
  return next;
}
/** Calculate a single position without depending on React or shared state. */
export function position(holding: Holding, quote?: Quote) {
  const invested = holding.qty * holding.avgPricePaise;
  const value = quote?.ltp === undefined ? undefined : holding.qty * quote.ltp;
  const pnl = value === undefined ? undefined : value - invested;
  const dayPnl =
    quote?.ltp === undefined || quote.prevClose === undefined
      ? undefined
      : holding.qty * (quote.ltp - quote.prevClose);
  return {
    invested,
    value,
    pnl,
    dayPnl,
    pnlPercent: pnl === undefined || invested === 0 ? undefined : (pnl / invested) * 100,
  };
}
/** Sum the same integer amounts shown in rows so displayed totals reconcile. */
export function summarize(
  holdings: readonly Holding[],
  quotes: Readonly<Record<string, Quote>>,
) {
  let invested = 0;
  let pricedInvested = 0;
  let value = 0;
  let pnl = 0;
  let dayPnl = 0;
  let previousValue = 0;
  let missing = 0;
  let missingDay = 0;
  for (const holding of holdings) {
    const row = position(holding, quotes[holding.symbol]);
    invested += row.invested;
    // Missing prices exclude both value and cost basis from the P&L subtotal.
    if (row.value === undefined || row.pnl === undefined) missing++;
    else {
      pricedInvested += row.invested;
      value += row.value;
      pnl += row.pnl;
    }
    // Today's change needs a previous close as well as the current price.
    const previousClose = quotes[holding.symbol]?.prevClose;
    if (row.dayPnl === undefined || previousClose === undefined) missingDay++;
    else {
      dayPnl += row.dayPnl;
      previousValue += holding.qty * previousClose;
    }
  }
  return {
    invested,
    value,
    pnl,
    dayPnl,
    missing,
    missingDay,
    pnlPercent: pricedInvested ? (pnl / pricedInvested) * 100 : undefined,
    dayPercent: previousValue ? (dayPnl / previousValue) * 100 : undefined,
  };
}
export function money(paise: number | undefined): string {
  return paise === undefined
    ? '--'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(paise / 100);
}
export function percent(value: number | undefined): string {
  return value === undefined ? '--' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export type HoldingSortKey = 'name' | 'value' | 'pnl';
export type SortDirection = 'ascending' | 'descending';

/** Never mutate the source holdings: their identities are also used by memoized rows. */
export function sortHoldings(
  holdings: readonly Holding[],
  quotes: Readonly<Record<string, Quote>>,
  sortKey: HoldingSortKey,
  direction: SortDirection,
): readonly Holding[] {
  const multiplier = direction === 'ascending' ? 1 : -1;

  return [...holdings].sort((left, right) => {
    const bySymbol = left.symbol.localeCompare(right.symbol);
    if (sortKey === 'name') return bySymbol * multiplier;

    const leftAmount = position(left, quotes[left.symbol])[sortKey];
    const rightAmount = position(right, quotes[right.symbol])[sortKey];

    // Missing is different from zero. Unpriced positions always come last,
    // even when sorting losses first; tied amounts use a stable symbol order.
    if (leftAmount === undefined && rightAmount === undefined) return bySymbol;
    if (leftAmount === undefined) return 1;
    if (rightAmount === undefined) return -1;
    return (leftAmount - rightAmount) * multiplier || bySymbol;
  });
}

/** Day change is unavailable unless both prices exist; zero close has no percentage. */
export function dayChange(quote?: Quote) {
  if (quote?.ltp === undefined || quote.prevClose === undefined) {
    return { amount: undefined, percentage: undefined };
  }
  const amount = quote.ltp - quote.prevClose;
  return {
    amount,
    percentage: quote.prevClose === 0 ? undefined : (amount / quote.prevClose) * 100,
  };
}
