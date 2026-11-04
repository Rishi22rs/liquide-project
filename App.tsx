import { useEffect } from 'react';
import { PortfolioScreen } from './src/features/portfolio/PortfolioScreen';
import { loadMarket, stopMarket } from './src/state/market';

export default function App() {
  // The app owns the feed lifecycle. Future screens share this one connection.
  useEffect(() => {
    void loadMarket();
    return stopMarket;
  }, []);

  return <PortfolioScreen />;
}
