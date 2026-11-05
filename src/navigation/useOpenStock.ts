import { useCallback } from 'react';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { RootStackParams } from './types';

/** Stack navigation bubbles out of either tab to the shared detail screen. */
export function useOpenStock() {
  const navigation = useNavigation<NavigationProp<RootStackParams>>();
  return useCallback(
    (symbol: string) => {
      navigation.navigate('StockDetail', { symbol });
    },
    [navigation],
  );
}
