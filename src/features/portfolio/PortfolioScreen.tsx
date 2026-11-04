import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { loadMarket, useMarketStatus } from '../../state/market';
import { useTheme } from '../../theme/theme';
import { HoldingsList } from './HoldingsList';
import { styles } from './styles';

export function PortfolioScreen() {
  const theme = useTheme();
  const status = useMarketStatus();
  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: theme.gain }]}>
            LIQUIDE / LIVE PORTFOLIO
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>
            Your money, in motion.
          </Text>
        </View>
      </View>
      <View style={[styles.feed, { backgroundColor: theme.accent }]}>
        <Text style={{ color: theme.text }}>
          {status.loading
            ? 'Connecting to price service…'
            : status.paused
              ? '● Prices paused'
              : '● Live simulated prices'}
        </Text>
        <Text style={{ color: theme.muted }}>20 ticks / sec</Text>
      </View>
      {status.error ? (
        <View style={styles.empty}>
          <Text style={{ color: theme.loss }}>{status.error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void loadMarket();
            }}
            style={[styles.retry, { backgroundColor: theme.accent }]}
          >
            <Text style={{ color: theme.text }}>Retry prices</Text>
          </Pressable>
          <Text style={{ color: theme.muted }}>
            Prices are unavailable. Pull to refresh after retrying.
          </Text>
        </View>
      ) : null}
      {status.loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.gain} />
          <Text style={{ color: theme.muted }}>Loading market prices…</Text>
        </View>
      ) : (
        <HoldingsList theme={theme} />
      )}
    </View>
  );
}
