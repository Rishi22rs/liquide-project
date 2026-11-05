import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createOrderHistoryStore } from '../domain/orderHistory';

// Namespace order IDs by launch, so persisted history cannot collide with a
// request counter that starts at zero after a restart.
export const tradingSessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const orderHistoryStore = createOrderHistoryStore(AsyncStorage, tradingSessionId);
export function useOrderHistory() {
  return useSyncExternalStore(orderHistoryStore.subscribe, orderHistoryStore.getSnapshot);
}
