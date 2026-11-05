import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PortfolioScreen } from '../features/portfolio/PortfolioScreen';
import { WatchlistScreen } from '../features/watchlist/WatchlistScreen';
import { useTheme } from '../theme/theme';

type MainTabParams = { Portfolio: undefined; Watchlist: undefined };
const Tab = createBottomTabNavigator<MainTabParams>();

function TabIcon({ name, color }: { name: keyof MainTabParams; color: string }) {
  return (
    <View accessible={false} style={iconStyles.container}>
      {name === 'Portfolio' ? (
        <>
          <View style={[iconStyles.handle, { borderColor: color }]} />
          <View style={[iconStyles.briefcase, { borderColor: color }]} />
          <View style={[iconStyles.seam, { backgroundColor: color }]} />
        </>
      ) : (
        <>
          <View style={[iconStyles.bookmark, { borderColor: color }]} />
          <View style={[iconStyles.bookmarkLeft, { backgroundColor: color }]} />
          <View style={[iconStyles.bookmarkRight, { backgroundColor: color }]} />
        </>
      )}
    </View>
  );
}

export function MainTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <NavigationContainer
      theme={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: theme.primary,
          background: theme.bg,
          card: theme.card,
          text: theme.text,
          border: theme.line,
        },
      }}
    >
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: theme.accentText,
          tabBarInactiveTintColor: theme.muted,
          tabBarStyle: {
            backgroundColor: theme.card,
            borderTopColor: theme.line,
            height: 64 + insets.bottom,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 8),
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarIcon: ({ color }) => <TabIcon name={route.name} color={color} />,
          // Preserve each screen's search/sort state while switching tabs.
          lazy: true,
        })}
      >
        <Tab.Screen name="Portfolio" component={PortfolioScreen} />
        <Tab.Screen name="Watchlist" component={WatchlistScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
const iconStyles = StyleSheet.create({
  container: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  handle: {
    position: 'absolute',
    top: 2,
    left: 8,
    width: 8,
    height: 5,
    borderWidth: 1.6,
    borderRadius: 2,
  },
  briefcase: {
    position: 'absolute',
    top: 6,
    left: 3,
    width: 18,
    height: 15,
    borderWidth: 1.6,
    borderRadius: 4,
  },
  seam: { position: 'absolute', top: 12, left: 4, width: 16, height: 1.6 },
  bookmark: {
    position: 'absolute',
    top: 3,
    left: 5,
    width: 14,
    height: 17,
    borderTopWidth: 1.6,
    borderLeftWidth: 1.6,
    borderRightWidth: 1.6,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  bookmarkLeft: {
    position: 'absolute',
    left: 5,
    top: 17,
    width: 8,
    height: 1.6,
    transform: [{ rotate: '-30deg' }],
  },
  bookmarkRight: {
    position: 'absolute',
    right: 5,
    top: 17,
    width: 8,
    height: 1.6,
    transform: [{ rotate: '30deg' }],
  },
});
