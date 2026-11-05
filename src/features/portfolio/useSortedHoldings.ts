import { useMemo, useSyncExternalStore } from 'react';
import {
  sortHoldings,
  type Holding,
  type HoldingSortKey,
  type SortDirection,
} from '../../domain/portfolio';
import { getQuotesSnapshot, subscribeToMarket } from '../../state/market';

const subscribeToNothing = () => () => {};

/** Prices can change without changing the list order. Only publish a new array
 * when positions actually move; individual price cells have their own subscriptions. */
export function useSortedHoldings(
  holdings: readonly Holding[],
  sortKey: HoldingSortKey,
  direction: SortDirection,
): readonly Holding[] {
  const getOrderSnapshot = useMemo(() => {
    let previousOrder: readonly Holding[] = [];

    return () => {
      const nextOrder = sortHoldings(holdings, getQuotesSnapshot(), sortKey, direction);
      const orderUnchanged =
        nextOrder.length === previousOrder.length &&
        nextOrder.every((holding, index) => holding === previousOrder[index]);

      // useSyncExternalStore requires a stable snapshot when its result is unchanged.
      if (!orderUnchanged) previousOrder = nextOrder;
      return previousOrder;
    };
  }, [holdings, sortKey, direction]);

  // Alphabetical ordering is independent of prices and needs no tick subscription.
  return useSyncExternalStore(
    sortKey === 'name' ? subscribeToNothing : subscribeToMarket,
    getOrderSnapshot,
  );
}
