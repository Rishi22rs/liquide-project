import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SwipeToRemove } from '../../components/SwipeToRemove';
import { dayChange, money, percent } from '../../domain/portfolio';
import { useQuote } from '../../state/market';
import { watchlistStore } from '../../state/watchlist';
import type { Theme } from '../../theme/theme';
import { styles } from './styles';

// Adding/removing a different stock never changes this row's quote subscription.
export const WatchlistRow = memo(function WatchlistRow({
  symbol,
  theme,
}: {
  symbol: string;
  theme: Theme;
}) {
  const quote = useQuote(symbol);
  const change = dayChange(quote);
  const color =
    change.amount === undefined
      ? theme.muted
      : change.amount >= 0
        ? theme.gain
        : theme.loss;
  const remove = () => watchlistStore.remove(symbol);

  return (
    <SwipeToRemove label={symbol} onRemove={remove} theme={theme}>
      <View style={[styles.row, { borderColor: theme.line }]}>
        <View
          style={[
            styles.monogram,
            { backgroundColor: theme.elevated, borderColor: theme.line },
          ]}
        >
          <Text style={[styles.monogramText, { color: theme.accentText }]}>
            {symbol.slice(0, 2)}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.symbol, { color: theme.text }]}>{symbol}</Text>
          <Text style={[styles.caption, { color: theme.muted }]}>NSE · Equity</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${symbol}`}
            onPress={remove}
            style={styles.removeLink}
          >
            <Text style={[styles.removeLabel, { color: theme.muted }]}>Remove</Text>
          </Pressable>
        </View>
        <View style={styles.right}>
          <Text style={[styles.price, { color: theme.text }]}>{money(quote?.ltp)}</Text>
          <Text style={[styles.change, { color }]}>
            {money(change.amount)} ({percent(change.percentage)})
          </Text>
        </View>
      </View>
    </SwipeToRemove>
  );
});
