import { memo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { money } from '../../domain/portfolio';
import type { HistoryEntry } from '../../domain/orderHistory';
import { useOpenStock } from '../../navigation/useOpenStock';
import {
  orderHistoryStore,
  useOrderHistory,
  tradingSessionId,
} from '../../state/orderHistory';
import { tradingStore } from '../../state/holdings';
import { useMarketStatus } from '../../state/market';
import { useTheme, type Theme } from '../../theme/theme';

const statusLabels = {
  pending: 'Pending',
  filled: 'Filled',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  expired: 'Expired',
};
function dateTime(time: number): string {
  return new Date(time).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
function FeedStatus({ theme }: { theme: Theme }) {
  const market = useMarketStatus();
  return (
    <Text
      style={[
        styles.status,
        { color: market.paused || market.loading ? theme.accentText : theme.gain },
      ]}
    >
      {market.loading ? 'Connecting' : market.paused ? 'Prices paused' : 'Simulated live'}
    </Text>
  );
}
const OrderRow = memo(function OrderRow({
  entry,
  theme,
}: {
  entry: HistoryEntry;
  theme: Theme;
}) {
  const openStock = useOpenStock();
  const statusColor =
    entry.status === 'filled'
      ? theme.gain
      : entry.status === 'rejected'
        ? theme.loss
        : entry.status === 'pending'
          ? theme.accentText
          : theme.muted;
  return (
    <View style={[styles.card, { borderColor: theme.line, backgroundColor: theme.card }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${entry.symbol} details for ${entry.side} ${entry.type} order, ${statusLabels[entry.status]}`}
        onPress={() => openStock(entry.symbol)}
        style={styles.content}
      >
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={[styles.symbol, { color: theme.text }]}>{entry.symbol}</Text>
            <Text style={[styles.caption, { color: theme.muted }]}>
              {entry.side === 'buy' ? 'Buy' : 'Sell'} ·{' '}
              {entry.type === 'market' ? 'Market' : 'Limit'} · {entry.quantity} share
              {entry.quantity === 1 ? '' : 's'}
            </Text>
          </View>
          <View
            style={[styles.badge, { borderColor: theme.line, backgroundColor: theme.bg }]}
          >
            <Text style={[styles.status, { color: statusColor }]}>
              {statusLabels[entry.status]}
            </Text>
          </View>
        </View>
        {entry.limitPricePaise !== undefined && (
          <View style={styles.row}>
            <Text style={[styles.caption, { color: theme.muted }]}>Limit price</Text>
            <Text style={[styles.value, { color: theme.text }]}>
              {money(entry.limitPricePaise)}
            </Text>
          </View>
        )}
        {entry.status === 'filled' && (
          <>
            <View style={styles.row}>
              <Text style={[styles.caption, { color: theme.muted }]}>Filled price</Text>
              <Text style={[styles.value, { color: theme.text }]}>
                {money(entry.pricePaise)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.caption, { color: theme.muted }]}>Total value</Text>
              <Text style={[styles.total, { color: theme.text }]}>
                {money(entry.valuePaise)}
              </Text>
            </View>
          </>
        )}
        <Text style={[styles.time, { color: theme.muted }]}>
          Placed {dateTime(entry.createdAt)}
        </Text>
        {entry.status !== 'pending' && (
          <Text style={[styles.time, { color: theme.muted }]}>
            {statusLabels[entry.status]} {dateTime(entry.filledAt ?? entry.updatedAt)}
          </Text>
        )}
        {entry.status === 'rejected' && (
          <Text style={[styles.caption, { color: theme.loss }]}>{entry.error}</Text>
        )}
        {entry.status === 'expired' && (
          <Text style={[styles.caption, { color: theme.muted }]}>
            App restarted before this order filled. No trade was placed.
          </Text>
        )}
      </Pressable>
      {entry.status === 'pending' && entry.sessionId === tradingSessionId && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Cancel ${entry.side} limit order for ${entry.symbol} from history`}
          onPress={() => tradingStore.cancelLimit(entry.id)}
          style={[styles.cancel, { borderTopColor: theme.line }]}
        >
          <Text style={[styles.status, { color: theme.loss }]}>Cancel order</Text>
        </Pressable>
      )}
    </View>
  );
});

export function OrderHistoryScreen() {
  const theme = useTheme();
  const history = useOrderHistory();
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: theme.bg }]}
    >
      <LinearGradient colors={[theme.headerStart, theme.headerEnd]} style={styles.header}>
        <View style={styles.row}>
          <Text style={[styles.eyebrow, { color: theme.accentText }]}>YOUR ACTIVITY</Text>
          <FeedStatus theme={theme} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Order history</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Every simulated order. Saved on this device.
        </Text>
      </LinearGradient>
      <FlatList
        data={history.entries}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => <OrderRow entry={item} theme={theme} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={[styles.caption, { color: theme.muted }]}>
              Pending orders expire on restart. Past orders are kept; portfolio positions
              reset.
            </Text>
            <View style={styles.row}>
              <Text style={[styles.status, { color: theme.muted }]}>
                {history.entries.length} ORDER{history.entries.length === 1 ? '' : 'S'}
              </Text>
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.caption, { color: theme.muted }]}
              >
                {history.saving
                  ? 'Saving…'
                  : history.hydrated && !history.error
                    ? 'Saved locally'
                    : ''}
              </Text>
            </View>
            {history.error && (
              <View style={[styles.error, { borderColor: theme.line }]}>
                <Text
                  accessibilityLiveRegion="polite"
                  style={[styles.caption, { color: theme.loss }]}
                >
                  {history.error}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry order history"
                  onPress={orderHistoryStore.retry}
                  style={styles.retry}
                >
                  <Text style={[styles.status, { color: theme.accentText }]}>Retry</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !history.hydrated && !history.loadFailed ? (
            <View style={styles.empty}>
              <ActivityIndicator color={theme.primary} />
              <Text style={[styles.caption, { color: theme.muted }]}>
                Loading saved orders…
              </Text>
            </View>
          ) : history.loadFailed ? undefined : (
            <View style={styles.empty}>
              <Text style={[styles.symbol, { color: theme.text }]}>
                Your first order starts here.
              </Text>
              <Text style={[styles.subtitle, { color: theme.muted }]}>
                Open a stock to place a simulated market or limit order.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 26 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  flex: { flex: 1, minWidth: 0, gap: 5 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontSize: 29, fontWeight: '700', letterSpacing: -0.9, marginTop: 28 },
  subtitle: { fontSize: 12, lineHeight: 19, marginTop: 8 },
  list: { paddingHorizontal: 18, paddingBottom: 28, gap: 14 },
  intro: { paddingTop: 18, gap: 18, paddingBottom: 4 },
  card: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  content: { padding: 18, gap: 12 },
  symbol: { fontSize: 16, fontWeight: '700' },
  caption: { fontSize: 11, lineHeight: 17 },
  status: { fontSize: 10, fontWeight: '700' },
  badge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  value: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  total: { fontSize: 19, fontWeight: '700', fontVariant: ['tabular-nums'] },
  time: { fontSize: 10, lineHeight: 16 },
  cancel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { borderWidth: 1, borderRadius: 16, padding: 15 },
  retry: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  empty: { paddingVertical: 48, paddingHorizontal: 12, alignItems: 'center', gap: 10 },
});
