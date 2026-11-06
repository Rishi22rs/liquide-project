import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StockDetailScreen } from '../features/stock-detail/StockDetailScreen';
import { useThemeMode } from '../state/themePreference';
import { useTheme } from '../theme/theme';
import { MainTabs } from './MainTabs';
import type { RootStackParams } from './types';

const Stack = createNativeStackNavigator<RootStackParams>();

export function AppNavigator() {
  const theme = useTheme();
  const navigationTheme = useThemeMode() === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <NavigationContainer
      theme={{
        ...navigationTheme,
        colors: {
          ...navigationTheme.colors,
          primary: theme.primary,
          background: theme.bg,
          card: theme.card,
          text: theme.text,
          border: theme.line,
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="Home" component={MainTabs} />
        <Stack.Screen name="StockDetail" component={StockDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
