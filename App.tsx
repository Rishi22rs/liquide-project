import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { startLimitOrderMatching } from './src/state/holdings';
import { watchlistStore } from './src/state/watchlist';
import { loadMarket, stopMarket } from './src/state/market';

export default function App() {
  // The app owns the feed lifecycle. All screens share this one connection.
  useEffect(() => {
    const stopMatching = startLimitOrderMatching();
    void loadMarket();
    void watchlistStore.load();
    return () => {
      stopMatching();
      stopMarket();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
