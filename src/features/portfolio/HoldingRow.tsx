import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { money, percent, position, type Holding } from '../../domain/portfolio';
import { useQuote } from '../../state/market';
import type { Theme } from '../../theme/theme';
import { useOpenStock } from '../../navigation/useOpenStock';
import { styles } from './styles';

// Each row subscribes to its own quote. Other symbols keep the same snapshot
// reference, so their ticks do not cause this row to render.
export const HoldingRow = memo(function HoldingRow({
  holding,
  theme,
}: {
  holding: Holding;
  theme: Theme;
}) {
  const openStock = useOpenStock();
  const quote = useQuote(holding.symbol);
  const metrics = position(holding, quote);
  const pnlColor =
    metrics.pnl === undefined ? theme.muted : metrics.pnl >= 0 ? theme.gain : theme.loss;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${holding.symbol} details`}
      onPress={() => openStock(holding.symbol)}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.line, opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <View
        style={[
          styles.monogram,
          { backgroundColor: theme.elevated, borderColor: theme.line },
        ]}
      >
        <Text style={{ color: theme.accentText, fontWeight: '800' }}>
          {holding.symbol.slice(0, 2)}
        </Text>
      </View>
      <View style={styles.flex}>
        <Text style={[styles.symbol, { color: theme.text }]}>{holding.symbol}</Text>
        <Text style={[styles.caption, { color: theme.muted }]}>
          {holding.qty} shares · Avg {money(holding.avgPricePaise)}
        </Text>
        <Text style={[styles.caption, { color: theme.muted }]}>
          Last {money(quote?.ltp)}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.symbol, { color: theme.text }]}>{money(metrics.value)}</Text>
        <Text style={[styles.caption, { color: pnlColor }]}>{money(metrics.pnl)}</Text>
        <View style={[styles.changeBadge, { backgroundColor: theme.elevated }]}>
          <Text style={[styles.changeText, { color: pnlColor }]}>
            {percent(metrics.pnlPercent)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});
