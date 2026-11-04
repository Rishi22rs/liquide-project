import { Text, View } from 'react-native';
import { HOLDINGS } from '../../data/holdings';
import { money, percent, summarize } from '../../domain/portfolio';
import { useQuotes } from '../../state/market';
import type { Theme } from '../../theme/theme';
import { styles } from './styles';

// The summary intentionally subscribes to all quotes: any held price may change totals.
export function PortfolioSummary({ theme }: { theme: Theme }) {
  const quotes = useQuotes();
  const summary = summarize(HOLDINGS, quotes);
  const hasPrices = summary.missing < HOLDINGS.length;
  return (
    <View
      style={[styles.summary, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <Text style={[styles.eyebrow, { color: theme.muted }]}>PRICED HOLDINGS VALUE</Text>
      <Text style={[styles.total, { color: theme.text }]}>
        {money(hasPrices ? summary.value : undefined)}
      </Text>
      <View style={styles.metrics}>
        <View style={styles.flex}>
          <Text style={[styles.caption, { color: theme.muted }]}>
            Total invested · all holdings
          </Text>
          <Text style={[styles.metric, { color: theme.text }]}>
            {money(summary.invested)}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.caption, { color: theme.muted }]}>
            Total P&L · priced holdings
          </Text>
          <Text
            style={[styles.metric, { color: summary.pnl >= 0 ? theme.gain : theme.loss }]}
          >
            {money(hasPrices ? summary.pnl : undefined)}
          </Text>
          <Text style={{ color: theme.muted }}>{percent(summary.pnlPercent)}</Text>
        </View>
      </View>
      <View style={[styles.day, { borderColor: theme.line }]}>
        <Text style={{ color: theme.muted }}>Today'summary P&L</Text>
        <Text style={{ color: summary.dayPnl >= 0 ? theme.gain : theme.loss }}>
          {money(summary.missingDay < HOLDINGS.length ? summary.dayPnl : undefined)} (
          {percent(summary.dayPercent)})
        </Text>
      </View>
      {summary.missing > 0 && (
        <Text style={[styles.note, { color: theme.muted }]}>
          {summary.missing} holding{summary.missing > 1 ? 'summary' : ''} without a price
          excluded from value and total P&L. Invested includes all holdings.
        </Text>
      )}
      {summary.missingDay > summary.missing && (
        <Text style={[styles.note, { color: theme.muted }]}>
          {summary.missingDay} holdings excluded from today'summary P&L because price or
          previous close is missing.
        </Text>
      )}
    </View>
  );
}
