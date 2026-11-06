import { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { themePreference, useThemeMode } from './src/state/themePreference';
import { useTheme } from './src/theme/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SimulatorDevMenu } from './src/features/developer/SimulatorDevMenu';
import { AppNavigator } from './src/navigation/AppNavigator';
import { orderHistoryStore } from './src/state/orderHistory';
import { startLimitOrderMatching } from './src/state/holdings';
import { watchlistStore } from './src/state/watchlist';
import { loadMarket, stopMarket } from './src/state/market';

export default function App() {
  const mode = useThemeMode();
  const theme = useTheme();
  useEffect(() => {
    if (Platform.OS !== 'web') Appearance.setColorScheme(mode);
  }, [mode]);
  // The app owns the feed lifecycle. All screens share this one connection.
  useEffect(() => {
    const stopMatching = startLimitOrderMatching();
    void loadMarket();
    void watchlistStore.load();
    void orderHistoryStore.load();
    void themePreference.load();
    return () => {
      stopMatching();
      stopMarket();
    };
  }, []);

  return (
    <SafeAreaProvider style={{ backgroundColor: theme.bg }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <AppNavigator />
      {__DEV__ && <SimulatorDevMenu />}
    </SafeAreaProvider>
  );
}
