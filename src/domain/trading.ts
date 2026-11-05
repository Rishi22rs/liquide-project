import type { Holding, Quote } from './portfolio';

export type TradeSide = 'buy' | 'sell';
export type TradeRequest = Readonly<{
  id: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
}>;
export type TradeFill = Readonly<
  TradeRequest & {
    pricePaise: number;
    valuePaise: number;
    filledAt: number;
    remainingQuantity: number;
    averagePricePaise?: number;
  }
>;
export type TradeResult = { ok: true; fill: TradeFill } | { ok: false; error: string };

/** Reject decimals, exponents, negative signs and unsafe integers instead of
 * quietly truncating input with parseInt. Leading zeroes are harmless. */
export function parseTradeQuantity(input: string): number | undefined {
  if (!/^\d+$/.test(input.trim())) return undefined;
  const quantity = Number(input.trim());
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : undefined;
}

export function validateTrade(
  side: TradeSide,
  quantity: number | undefined,
  holding: Holding | undefined,
  pricePaise: number | undefined,
): string | undefined {
  if (quantity === undefined || !Number.isSafeInteger(quantity) || quantity <= 0)
    return 'Enter a whole-number quantity above zero.';
  if (side === 'sell' && quantity > (holding?.qty ?? 0))
    return `You can sell up to ${holding?.qty ?? 0} shares.`;
  if (pricePaise === undefined || !Number.isSafeInteger(pricePaise) || pricePaise <= 0)
    return 'A valid price is unavailable. Refresh prices and try again.';
  if (!Number.isSafeInteger(quantity * pricePaise))
    return 'This order value is too large.';
  if (side === 'buy' && !Number.isSafeInteger((holding?.qty ?? 0) + quantity))
    return 'This quantity is too large.';
  if (
    side === 'buy' &&
    !Number.isSafeInteger(((holding?.qty ?? 0) + quantity) * pricePaise)
  )
    return 'This position value is too large.';
  return undefined;
}

/** Cost basis is exact integer paise. Weighted averages retain sub-paise
 * precision and are rounded only for display; never rebuild cost from that display. */
export function calculateTrade(
  holding: Holding | undefined,
  symbol: string,
  side: TradeSide,
  quantity: number,
  pricePaise: number,
): Holding | undefined {
  const error = validateTrade(side, quantity, holding, pricePaise);
  if (error) throw new Error(error);
  const previousQuantity = holding?.qty ?? 0;
  const previousCost = holding
    ? (holding.costBasisPaise ?? holding.qty * holding.avgPricePaise)
    : 0;

  if (side === 'buy') {
    const qty = previousQuantity + quantity;
    const costBasisPaise = previousCost + quantity * pricePaise;
    if (!Number.isSafeInteger(costBasisPaise))
      throw new Error('This position value is too large.');
    return { symbol, qty, costBasisPaise, avgPricePaise: costBasisPaise / qty };
  }

  if (!holding) throw new Error('No shares are available to sell.');
  const qty = previousQuantity - quantity;
  if (qty === 0) return undefined;
  // Selling does not change the remaining shares' average acquisition price.
  // Round the remaining proportional basis once to paise; never multiply an
  // average that has already been rounded for presentation.
  return {
    symbol,
    qty,
    avgPricePaise: holding.avgPricePaise,
    costBasisPaise: proportionalCost(previousCost, qty, previousQuantity),
  };
}

/** Integer division avoids a one-paise error from floating-point ratios,
 * including at large values. Round half a paise upward, then return a safe number. */
function proportionalCost(
  cost: number,
  remainingQuantity: number,
  previousQuantity: number,
): number {
  const numerator = BigInt(cost) * BigInt(remainingQuantity);
  const denominator = BigInt(previousQuantity);
  return Number((numerator + denominator / 2n) / denominator);
}

/** Synchronous local execution: quote lookup, validation and position publication
 * form one transaction. Storage/network operations never split this update. */
export function createTradingStore(
  initialHoldings: readonly Holding[],
  getQuote: (symbol: string) => Quote | undefined,
  allowedSymbols: readonly string[],
  now: () => number = Date.now,
) {
  let holdings: readonly Holding[] = [...initialHoldings];
  const listeners = new Set<() => void>();
  const filledRequests = new Map<string, { request: TradeRequest; fill: TradeFill }>();

  return {
    getSnapshot: () => holdings,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    submit(request: TradeRequest): TradeResult {
      const previousFill = filledRequests.get(request.id);
      if (previousFill) {
        const sameRequest =
          request.symbol === previousFill.request.symbol &&
          request.side === previousFill.request.side &&
          request.quantity === previousFill.request.quantity;
        return sameRequest
          ? { ok: true, fill: previousFill.fill }
          : { ok: false, error: 'This order was already confirmed. Open a new trade.' };
      }
      const holding = holdings.find((item) => item.symbol === request.symbol);
      if (!allowedSymbols.includes(request.symbol) && !holding)
        return { ok: false, error: 'This stock is not available for trading.' };
      // Read the current store price here, never trust the sheet's estimate.
      const quote = getQuote(request.symbol);
      if (quote?.symbol !== request.symbol || quote.ltp === undefined)
        return {
          ok: false,
          error: 'A price is unavailable. Refresh prices and try again.',
        };
      let nextHoldings: readonly Holding[];
      let fill: TradeFill;
      try {
        const updated = calculateTrade(
          holding,
          request.symbol,
          request.side,
          request.quantity,
          quote.ltp,
        );
        fill = {
          ...request,
          pricePaise: quote.ltp,
          valuePaise: request.quantity * quote.ltp,
          filledAt: now(),
          remainingQuantity: updated?.qty ?? 0,
          averagePricePaise: updated?.avgPricePaise,
        };
        if (updated) {
          nextHoldings = holding
            ? holdings.map((item) => (item.symbol === request.symbol ? updated : item))
            : [...holdings, updated];
        } else {
          nextHoldings = holdings.filter((item) => item.symbol !== request.symbol);
        }
        // Portfolio totals must also remain inside exact integer arithmetic limits.
        const totalCost = nextHoldings.reduce(
          (total, item) => total + (item.costBasisPaise ?? item.qty * item.avgPricePaise),
          0,
        );
        if (!Number.isSafeInteger(totalCost))
          return { ok: false, error: 'This portfolio value is too large.' };
      } catch (error: unknown) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'The simulated order could not be filled.',
        };
      }
      filledRequests.set(request.id, { request: { ...request }, fill });
      holdings = nextHoldings;
      listeners.forEach((listener) => listener());
      return { ok: true, fill };
    },
  };
}
