import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GradientButton } from '../../components/GradientButton';
import { loadMarket, useMarketStatus } from '../../state/market';
import { useTheme } from '../../theme/theme';
import { HoldingsList } from './HoldingsList';
import { styles } from './styles';

export function PortfolioScreen() {
  const theme = useTheme();
  const status = useMarketStatus();
  const feedColor = status.paused || status.loading ? theme.accentText : theme.gain;
  let feedLabel = 'Simulated live prices';
  if (status.loading) feedLabel = 'Connecting to prices';
  else if (status.paused) feedLabel = 'Prices paused';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg }]}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={[styles.brandMark, { backgroundColor: theme.accent }]}>
            <Text style={[styles.brandLetter, { color: theme.accentText }]}>L</Text>
          </View>
          <Text style={[styles.brandName, { color: theme.text }]}>liquide</Text>
          <View style={[styles.tag, { borderColor: theme.line }]}>
            <Text style={[styles.tagLabel, { color: theme.muted }]}>PAPER PORTFOLIO</Text>
          </View>
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Your portfolio</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Every holding. One clear picture.
        </Text>
      </View>
      <View
        style={[styles.feed, { borderColor: theme.line, backgroundColor: theme.card }]}
      >
        <View style={styles.feedLabel}>
          <View style={[styles.statusDot, { backgroundColor: feedColor }]} />
          <Text style={[styles.feedText, { color: feedColor }]}>{feedLabel}</Text>
        </View>
        <Text style={[styles.caption, { color: theme.muted }]}>NSE · INR</Text>
      </View>
      {status.error && (
        <View
          style={[
            styles.errorCard,
            { backgroundColor: theme.card, borderColor: theme.line },
          ]}
        >
          <Text style={[styles.metric, { color: theme.text }]}>
            Couldn't refresh prices
          </Text>
          <Text style={[styles.note, { color: theme.muted }]}>{status.error}</Text>
          <GradientButton
            label="Try again"
            onPress={() => {
              void loadMarket();
            }}
            theme={theme}
          />
        </View>
      )}
      {status.loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.gold} />
          <Text style={{ color: theme.muted }}>Loading market prices…</Text>
        </View>
      ) : (
        <HoldingsList theme={theme} />
      )}
    </SafeAreaView>
  );
}
