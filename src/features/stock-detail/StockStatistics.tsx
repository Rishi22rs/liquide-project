import { Text, View } from 'react-native';
import { money, type Quote } from '../../domain/portfolio';
import type { Theme } from '../../theme/theme';
import { styles } from './styles';

export function StockStatistics({ quote, theme }: { quote?: Quote; theme: Theme }) {
  const metrics = [
    { label: 'Open', value: money(quote?.open) },
    { label: 'Previous close', value: money(quote?.prevClose) },
    { label: 'Day high', value: money(quote?.high) },
    { label: 'Day low', value: money(quote?.low) },
    {
      label: 'Volume',
      value:
        quote?.volume === undefined
          ? '--'
          : new Intl.NumberFormat('en-IN').format(quote.volume),
    },
  ];
  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.text }]}>Market overview</Text>
      <View
        style={[
          styles.card,
          styles.grid,
          { backgroundColor: theme.card, borderColor: theme.line },
        ]}
      >
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.metric}>
            <Text style={[styles.caption, { color: theme.muted }]}>{metric.label}</Text>
            <Text style={[styles.metricValue, { color: theme.text }]}>
              {metric.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
