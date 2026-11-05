import { memo } from 'react';
import { Text, View } from 'react-native';
import { SwipeToRemove } from '../../components/SwipeToRemove';
import { dayChange, money, percent } from '../../domain/portfolio';
import { useQuote } from '../../state/market';
import { watchlistStore } from '../../state/watchlist';
import type { Theme } from '../../theme/theme';
import { useOpenStock } from '../../navigation/useOpenStock';
import { styles } from './styles';

// Adding/removing a different stock never changes this row's quote subscription.
export const WatchlistRow = memo(function WatchlistRow({
  symbol,
  theme,
}: {
  symbol: string;
  theme: Theme;
}) {
  const openStock = useOpenStock();
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
    <SwipeToRemove
      label={symbol}
      onRemove={remove}
      onPress={() => openStock(symbol)}
      theme={theme}
      accessibilityLabel={`${symbol}, last price ${money(quote?.ltp)}, day change ${money(change.amount)}, ${percent(change.percentage)}`}
    >
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
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[styles.symbol, { color: theme.text }]}
          >
            {symbol}
          </Text>
          <Text style={[styles.caption, { color: theme.muted }]}>NSE · Equity</Text>
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
