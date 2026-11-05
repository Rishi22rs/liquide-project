import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MainTabs } from './src/navigation/MainTabs';
import { watchlistStore } from './src/state/watchlist';
import { loadMarket, stopMarket } from './src/state/market';

export default function App() {
  // The app owns the feed lifecycle. All screens share this one connection.
  useEffect(() => {
    void loadMarket();
    void watchlistStore.load();
    return stopMarket;
  }, []);

  return (
    <SafeAreaProvider>
      <MainTabs />
    </SafeAreaProvider>
  );
}
