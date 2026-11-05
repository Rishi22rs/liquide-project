import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useHoldings } from '../../state/holdings';
import { money, percent, summarize } from '../../domain/portfolio';
import { useQuotes } from '../../state/market';
import type { Theme } from '../../theme/theme';
import { styles } from './styles';

// Only this card needs the whole quote map. Other holdings update independently.
export function PortfolioSummary({ theme }: { theme: Theme }) {
  const quotes = useQuotes();
  const holdings = useHoldings();
  const summary = summarize(holdings, quotes);
  const hasPrices = summary.missing < holdings.length || holdings.length === 0;
  const pnlColor = !hasPrices ? theme.muted : summary.pnl >= 0 ? theme.gain : theme.loss;
  const hasDayPrices = summary.missingDay < holdings.length || holdings.length === 0;
  const dayColor = !hasDayPrices
    ? theme.muted
    : summary.dayPnl >= 0
      ? theme.gain
      : theme.loss;

  return (
    <LinearGradient
      colors={[theme.summaryStart, theme.summaryEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0.8 }}
      style={[styles.summary, { borderColor: theme.line }]}
    >
      <View style={styles.summaryHeading}>
        <Text style={[styles.eyebrow, { color: theme.muted }]}>CURRENT VALUE</Text>
        <View style={[styles.tag, { borderColor: theme.line }]}>
          <Text style={[styles.tagLabel, { color: theme.accentText }]}>
            PRICED HOLDINGS
          </Text>
        </View>
      </View>
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        style={[styles.total, { color: theme.text }]}
      >
        {money(hasPrices ? summary.value : undefined)}
      </Text>
      <View style={styles.metrics}>
        <View style={styles.flex}>
          <Text style={[styles.caption, { color: theme.muted }]}>
            Invested · all holdings
          </Text>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[styles.metric, { color: theme.text }]}
          >
            {money(summary.invested)}
          </Text>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: theme.line }]} />
        <View style={styles.flex}>
          <Text style={[styles.caption, { color: theme.muted }]}>Total P&L · priced</Text>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[styles.metric, { color: pnlColor }]}
          >
            {money(hasPrices ? summary.pnl : undefined)}
          </Text>
          <Text style={[styles.changeText, { color: pnlColor }]}>
            {percent(summary.pnlPercent)}
          </Text>
        </View>
      </View>
      <View style={[styles.day, { borderColor: theme.line }]}>
        <Text style={[styles.caption, { color: theme.muted }]}>Today's P&L</Text>
        <View style={styles.right}>
          <Text style={[styles.dayValue, { color: dayColor }]}>
            {money(hasDayPrices ? summary.dayPnl : undefined)}
          </Text>
          <Text style={[styles.changeText, { color: dayColor }]}>
            {percent(summary.dayPercent)}
          </Text>
        </View>
      </View>
      {/* Keep the missing-price disclosure next to the totals it qualifies. */}
      {summary.missing > 0 && (
        <View style={[styles.disclosure, { borderColor: theme.line }]}>
          <Text style={[styles.infoIcon, { color: theme.accentText }]}>i</Text>
          <Text style={[styles.note, styles.flex, { color: theme.muted }]}>
            {summary.missing} holding{summary.missing > 1 ? 's' : ''} without a price
            excluded from value and total P&L. Invested includes all holdings.
          </Text>
        </View>
      )}
      {summary.missingDay > summary.missing && (
        <Text style={[styles.note, { color: theme.muted }]}>
          {summary.missingDay} holdings excluded from today's P&L because price or
          previous close is missing.
        </Text>
      )}
    </LinearGradient>
  );
}
