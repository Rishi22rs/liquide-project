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

export type LimitOrderRequest = TradeRequest & Readonly<{ limitPricePaise: number }>;
export type LimitOrder = LimitOrderRequest &
  Readonly<{ placedAt: number }> &
  (
    | Readonly<{ status: 'pending' | 'cancelled' }>
    | Readonly<{ status: 'filled'; fill: TradeFill }>
    | Readonly<{ status: 'rejected'; error: string }>
  );
export type LimitOrderResult =
  { ok: true; order: LimitOrder } | { ok: false; error: string };

export type TradingEvent =
  | Readonly<{ type: 'market'; fill: TradeFill }>
  | Readonly<{ type: 'limit'; order: LimitOrder; updatedAt: number }>;

/** Parse decimal rupees directly to paise without floating-point multiplication. */
export function parseLimitPrice(input: string): number | undefined {
  if (input.trim().length > 32 || !/^\d+(?:\.\d{1,2})?$/.test(input.trim()))
    return undefined;
  const [whole, fraction = ''] = input.trim().split('.');
  const value = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
  return value > 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(value)
    : undefined;
}

export function limitReached(side: TradeSide, price: number, limit: number): boolean {
  return side === 'buy' ? price <= limit : price >= limit;
}

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
  onOrder: (event: TradingEvent) => void = () => {},
) {
  let holdings: readonly Holding[] = [...initialHoldings];
  const listeners = new Set<() => void>();
  const filledRequests = new Map<string, { request: TradeRequest; fill: TradeFill }>();

  let orders: readonly LimitOrder[] = [];
  const orderListeners = new Set<() => void>();
  function availableToSell(symbol: string, exceptId?: string): number {
    const held = holdings.find((item) => item.symbol === symbol)?.qty ?? 0;
    const reserved = orders.reduce(
      (total, order) =>
        total +
        (order.symbol === symbol &&
        order.side === 'sell' &&
        order.status === 'pending' &&
        order.id !== exceptId
          ? order.quantity
          : 0),
      0,
    );
    return Math.max(0, held - reserved);
  }
  function publishOrders() {
    orderListeners.forEach((listener) => listener());
  }

  function execute(
    request: TradeRequest,
    executionPrice?: number,
    matchingId?: string,
  ): TradeResult {
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
    if (
      request.side === 'sell' &&
      request.quantity > availableToSell(request.symbol, matchingId) &&
      availableToSell(request.symbol, matchingId) < (holding?.qty ?? 0)
    )
      return {
        ok: false,
        error: `Only ${availableToSell(request.symbol, matchingId)} shares are available; pending sell orders reserve the rest.`,
      };
    // Read the current store price here, never trust the sheet's estimate.
    const quote = getQuote(request.symbol);
    if (
      executionPrice === undefined &&
      (quote?.symbol !== request.symbol || quote.ltp === undefined)
    )
      return {
        ok: false,
        error: 'A price is unavailable. Refresh prices and try again.',
      };
    const fillPrice = executionPrice ?? quote?.ltp;
    if (fillPrice === undefined) return { ok: false, error: 'A price is unavailable.' };
    let nextHoldings: readonly Holding[];
    let fill: TradeFill;
    try {
      const updated = calculateTrade(
        holding,
        request.symbol,
        request.side,
        request.quantity,
        fillPrice,
      );
      fill = {
        ...request,
        pricePaise: fillPrice,
        valuePaise: request.quantity * fillPrice,
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
    if (!matchingId) {
      onOrder({ type: 'market', fill });
      listeners.forEach((listener) => listener());
    }
    return { ok: true, fill };
  }

  return {
    getSnapshot: () => holdings,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getOrdersSnapshot: () => orders,
    subscribeOrders(listener: () => void) {
      orderListeners.add(listener);
      return () => {
        orderListeners.delete(listener);
      };
    },
    availableToSell,
    submit(request: TradeRequest): TradeResult {
      if (orders.some((order) => order.id === request.id))
        return {
          ok: false,
          error: 'This ID belongs to a limit order. Open a new trade.',
        };
      return execute(request);
    },
    placeLimit(request: LimitOrderRequest): LimitOrderResult {
      const existing = orders.find((order) => order.id === request.id);
      if (existing) {
        return existing.symbol === request.symbol &&
          existing.side === request.side &&
          existing.quantity === request.quantity &&
          existing.limitPricePaise === request.limitPricePaise
          ? { ok: true, order: existing }
          : { ok: false, error: 'This order was already placed. Open a new trade.' };
      }
      if (filledRequests.has(request.id))
        return { ok: false, error: 'This order ID was already used.' };
      const holding = holdings.find((item) => item.symbol === request.symbol);
      if (!allowedSymbols.includes(request.symbol) && !holding)
        return { ok: false, error: 'This stock is not available for trading.' };
      const error = validateTrade(
        request.side,
        request.quantity,
        holding,
        request.limitPricePaise,
      );
      if (error) return { ok: false, error };
      if (request.side === 'sell' && request.quantity > availableToSell(request.symbol))
        return {
          ok: false,
          error: `Only ${availableToSell(request.symbol)} shares are available; pending sell orders reserve the rest.`,
        };
      const order: LimitOrder = { ...request, placedAt: now(), status: 'pending' };
      orders = [...orders, order];
      onOrder({ type: 'limit', order, updatedAt: order.placedAt });
      publishOrders();
      return { ok: true, order };
    },
    cancelLimit(id: string): boolean {
      if (!orders.some((order) => order.id === id && order.status === 'pending'))
        return false;
      orders = orders.map((order) =>
        order.id === id ? { ...order, status: 'cancelled' } : order,
      );
      const cancelled = orders.find((order) => order.id === id);
      if (cancelled) onOrder({ type: 'limit', order: cancelled, updatedAt: now() });
      publishOrders();
      return true;
    },
    /** Called only for accepted price ticks, never volume updates or REST snapshots.
     * FIFO matching uses the received price, including improvements beyond the limit. */
    processPriceTick(symbol: string, price: number) {
      if (!Number.isSafeInteger(price) || price <= 0) return;
      let changed = false;
      let holdingsChanged = false;
      for (const order of orders) {
        if (
          order.symbol !== symbol ||
          order.status !== 'pending' ||
          !limitReached(order.side, price, order.limitPricePaise)
        )
          continue;
        const result = execute(order, price, order.id);
        const updated: LimitOrder = result.ok
          ? { ...order, status: 'filled', fill: result.fill }
          : { ...order, status: 'rejected', error: result.error };
        orders = orders.map((item) => (item.id === order.id ? updated : item));
        onOrder({ type: 'limit', order: updated, updatedAt: now() });
        changed = true;
        holdingsChanged ||= result.ok;
      }
      // Publish after both positions and order statuses have changed, so every
      // subscriber observes the same complete transaction batch.
      if (holdingsChanged) listeners.forEach((listener) => listener());
      if (changed) publishOrders();
    },
  };
}
