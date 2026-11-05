import { Text, View } from 'react-native';
import { useHolding } from '../../state/holdings';
import { money, percent, position, type Quote } from '../../domain/portfolio';
import type { Theme } from '../../theme/theme';
import { styles } from './styles';

export function StockPosition({
  symbol,
  quote,
  theme,
}: {
  symbol: string;
  quote?: Quote;
  theme: Theme;
}) {
  const holding = useHolding(symbol);
  if (!holding)
    return (
      <View
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}
      >
        <Text style={[styles.heading, { color: theme.text }]}>Your position</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          You don't hold shares in this stock.
        </Text>
      </View>
    );

  const metrics = position(holding, quote);
  const pnlColor =
    metrics.pnl === undefined ? theme.muted : metrics.pnl >= 0 ? theme.gain : theme.loss;
  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.text }]}>Your position</Text>
      <View
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}
      >
        <View style={styles.cardTop}>
          <Text style={[styles.metricValue, { color: theme.text }]}>
            {holding.qty} shares
          </Text>
          <Text style={[styles.change, { color: pnlColor }]}>
            {percent(metrics.pnlPercent)}
          </Text>
        </View>
        <View style={styles.grid}>
          <View style={styles.metric}>
            <Text style={[styles.caption, { color: theme.muted }]}>Average price</Text>
            <Text style={[styles.metricValue, { color: theme.text }]}>
              {money(holding.avgPricePaise)}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.caption, { color: theme.muted }]}>Invested</Text>
            <Text style={[styles.metricValue, { color: theme.text }]}>
              {money(metrics.invested)}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.caption, { color: theme.muted }]}>Current value</Text>
            <Text style={[styles.metricValue, { color: theme.text }]}>
              {money(metrics.value)}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.caption, { color: theme.muted }]}>Total P&L</Text>
            <Text style={[styles.metricValue, { color: pnlColor }]}>
              {money(metrics.pnl)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
