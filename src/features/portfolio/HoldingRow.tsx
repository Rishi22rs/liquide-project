import { memo } from 'react';
import { Text, View } from 'react-native';
import { money, percent, position, type Holding } from '../../domain/portfolio';
import { useQuote } from '../../state/market';
import type { Theme } from '../../theme/theme';
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
  const quote = useQuote(holding.symbol);
  const metrics = position(holding, quote);
  return (
    <View style={[styles.row, { borderColor: theme.line }]}>
      <View style={[styles.monogram, { backgroundColor: theme.accent }]}>
        <Text style={{ color: theme.gain, fontWeight: '700' }}>
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
        <Text
          style={[
            styles.caption,
            {
              color:
                metrics.pnl === undefined
                  ? theme.muted
                  : metrics.pnl >= 0
                    ? theme.gain
                    : theme.loss,
            },
          ]}
        >
          {money(metrics.pnl)} ({percent(metrics.pnlPercent)})
        </Text>
      </View>
    </View>
  );
});
