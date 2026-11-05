import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SYMBOLS } from '../data/holdings';
import { createWatchlistStore } from '../domain/watchlist';

export const watchlistStore = createWatchlistStore(AsyncStorage, SYMBOLS);

export function useWatchlist() {
  return useSyncExternalStore(watchlistStore.subscribe, watchlistStore.getSnapshot);
}
