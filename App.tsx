import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PortfolioScreen } from './src/features/portfolio/PortfolioScreen';
import { loadMarket, stopMarket } from './src/state/market';

export default function App() {
  // The app owns the feed lifecycle. Future screens share this one connection.
  useEffect(() => {
    void loadMarket();
    return stopMarket;
  }, []);

  return (
    <SafeAreaProvider>
      <PortfolioScreen />
    </SafeAreaProvider>
  );
}
