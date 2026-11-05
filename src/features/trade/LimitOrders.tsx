import { Pressable, StyleSheet, Text, View } from 'react-native';
import { money } from '../../domain/portfolio';
import type { LimitOrder } from '../../domain/trading';
import { tradingStore, useLimitOrders } from '../../state/holdings';
import type { Theme } from '../../theme/theme';
import { TradeReceipt } from './TradeReceipt';

export function LimitOrderStatus({ order, theme }: { order: LimitOrder; theme: Theme }) {
  if (order.status === 'filled' && order.fill)
    return <TradeReceipt fill={order.fill} theme={theme} />;
  return (
    <View style={[styles.card, { borderColor: theme.line, backgroundColor: theme.card }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        {order.side === 'buy' ? 'Buy' : 'Sell'} {order.quantity} {order.symbol}
      </Text>
      <Text style={[styles.label, { color: theme.muted }]}>
        Limit {money(order.limitPricePaise)} · {order.status}
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.body, { color: theme.muted }]}
      >
        {order.status === 'pending'
          ? `Waiting for a received price ${order.side === 'buy' ? 'at or below' : 'at or above'} your limit. Orders are session-only.`
          : order.status === 'rejected'
            ? order.error
            : 'Cancelled. No shares were traded.'}
      </Text>
      {order.status === 'pending' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Cancel ${order.side} limit order for ${order.symbol}`}
          onPress={() => tradingStore.cancelLimit(order.id)}
          style={[styles.cancel, { borderColor: theme.line }]}
        >
          <Text style={[styles.label, { color: theme.loss }]}>Cancel order</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Current-session orders remain accessible after closing the trade sheet.
 * The persisted Orders tab holds the full archive; this is a compact session view. */
export function LimitOrders({ symbol, theme }: { symbol: string; theme: Theme }) {
  const orders = useLimitOrders().filter((order) => order.symbol === symbol);
  if (!orders.length) return null;
  // Keep every pending order manageable; completed statuses are limited to five.
  const pending = orders.filter((order) => order.status === 'pending');
  const completed = orders
    .filter((order) => order.status !== 'pending')
    .slice(-5)
    .reverse();
  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: theme.text }]}>
        Limit orders · this session
      </Text>
      {[...pending, ...completed].map((order) => (
        <View
          key={order.id}
          style={[styles.card, { borderColor: theme.line, backgroundColor: theme.card }]}
        >
          <Text style={[styles.label, { color: theme.text }]}>
            {order.side === 'buy' ? 'Buy' : 'Sell'} {order.quantity} · Limit{' '}
            {money(order.limitPricePaise)}
          </Text>
          <Text
            style={[
              styles.body,
              { color: order.status === 'filled' ? theme.gain : theme.muted },
            ]}
          >
            {order.status === 'filled'
              ? `Filled at ${money(order.fill?.pricePaise)}`
              : order.status === 'rejected'
                ? `Rejected: ${order.error}`
                : order.status === 'pending'
                  ? 'Pending · Waiting for an eligible live tick'
                  : 'Cancelled'}
          </Text>
          {order.status === 'pending' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Cancel ${order.side} limit order for ${symbol} at ${money(order.limitPricePaise)}`}
              onPress={() => tradingStore.cancelLimit(order.id)}
              style={[styles.cancel, { borderColor: theme.line }]}
            >
              <Text style={[styles.label, { color: theme.loss }]}>Cancel order</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: 12 },
  card: { padding: 18, borderWidth: 1, borderRadius: 20, gap: 10 },
  title: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600' },
  body: { fontSize: 11, lineHeight: 17 },
  cancel: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
});
