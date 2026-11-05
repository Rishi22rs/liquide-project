import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from '../../components/GradientButton';
import { loadMarket, useMarketStatus } from '../../state/market';
import { useWatchlist, watchlistStore } from '../../state/watchlist';
import { useTheme } from '../../theme/theme';
import { StockPicker } from './StockPicker';
import { WatchlistRow } from './WatchlistRow';
import { styles } from './styles';

export function WatchlistScreen() {
  const theme = useTheme();
  const watchlist = useWatchlist();
  const market = useMarketStatus();
  const [pickerOpen, setPickerOpen] = useState(false);
  const loading = !watchlist.hydrated;
  const editable = !loading && !watchlist.loadFailed;
  const statusColor = market.paused || market.loading ? theme.accentText : theme.gain;
  const statusLabel = market.loading
    ? 'Connecting'
    : market.paused
      ? 'Prices paused'
      : 'Simulated live';

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: theme.bg }]}
    >
      <LinearGradient colors={[theme.headerStart, theme.headerEnd]} style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.eyebrow, { color: theme.accentText }]}>
            YOUR MARKET RADAR
          </Text>
          <View style={styles.status}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <View style={styles.headerTop}>
          <View style={styles.flex}>
            <Text style={[styles.title, { color: theme.text }]}>Watchlist</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>
              The stocks you want to keep close.
            </Text>
          </View>
          {editable && watchlist.symbols.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add stocks"
              onPress={() => setPickerOpen(true)}
              style={[
                styles.pickerAction,
                { borderColor: theme.line, backgroundColor: theme.accent },
              ]}
            >
              <Text style={[styles.label, { color: theme.accentText }]}>+ Add</Text>
            </Pressable>
          )}
        </View>
      </LinearGradient>
      <FlatList
        data={loading || watchlist.loadFailed ? [] : watchlist.symbols}
        keyExtractor={(symbol) => symbol}
        renderItem={({ item }) => <WatchlistRow symbol={item} theme={theme} />}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={market.loading}
            onRefresh={() => {
              void loadMarket();
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListHeaderComponent={
          <>
            {watchlist.error && (
              <View
                style={[
                  styles.error,
                  { borderColor: theme.line, backgroundColor: theme.card },
                ]}
              >
                <Text style={[styles.caption, { color: theme.text }]}>
                  {watchlist.error}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={watchlistStore.retry}
                  style={styles.retry}
                >
                  <Text style={[styles.retryLabel, { color: theme.accentText }]}>
                    Retry watchlist
                  </Text>
                </Pressable>
              </View>
            )}
            {market.error && (
              <View
                style={[
                  styles.error,
                  { borderColor: theme.line, backgroundColor: theme.card },
                ]}
              >
                <Text style={[styles.caption, { color: theme.muted }]}>
                  Prices unavailable. {market.error}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void loadMarket();
                  }}
                  style={styles.retry}
                >
                  <Text style={[styles.retryLabel, { color: theme.accentText }]}>
                    Retry prices
                  </Text>
                </Pressable>
              </View>
            )}
            {editable && watchlist.symbols.length > 0 && (
              <>
                <View style={styles.section}>
                  <Text style={[styles.label, { color: theme.muted }]}>
                    {watchlist.symbols.length}{' '}
                    {watchlist.symbols.length === 1 ? 'STOCK' : 'STOCKS'}
                  </Text>
                  <Text style={[styles.label, { color: theme.muted }]}>
                    {watchlist.saving ? 'Saving…' : 'PRICE / DAY CHANGE'}
                  </Text>
                </View>
                <Text style={[styles.caption, { color: theme.muted }]}>
                  Swipe left to remove a stock
                </Text>
              </>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={theme.primary} />
              <Text style={{ color: theme.muted }}>Loading your watchlist…</Text>
            </View>
          ) : watchlist.loadFailed ? (
            <View />
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                A little focus goes a long way.
              </Text>
              <Text style={[styles.emptyBody, { color: theme.muted }]}>
                Save stocks here to follow their live prices and daily moves. Your list
                stays with you after a restart.
              </Text>
              <View style={styles.emptyAction}>
                <GradientButton
                  label="Add your first stock"
                  onPress={() => setPickerOpen(true)}
                  theme={theme}
                />
              </View>
            </View>
          )
        }
      />
      {pickerOpen && <StockPicker onClose={() => setPickerOpen(false)} theme={theme} />}
    </SafeAreaView>
  );
}
