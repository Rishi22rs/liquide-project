import { memo, useId, useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';
import { buildTickChart } from '../../domain/tickHistory';
import { money } from '../../domain/portfolio';
import type { Theme } from '../../theme/theme';
import { useTickHistory } from './useTickHistory';
import { styles } from './styles';

function clockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export const LiveTickChart = memo(function LiveTickChart({
  symbol,
  available,
  theme,
}: {
  symbol: string;
  available: boolean;
  theme: Theme;
}) {
  const points = useTickHistory(symbol);
  const chart = useMemo(() => buildTickChart(points), [points]);
  const gradientId = useId().replace(/:/g, '');
  const color =
    !chart || chart.last.price === chart.first.price
      ? theme.accentText
      : chart.last.price > chart.first.price
        ? theme.gain
        : theme.loss;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <View style={styles.cardTop}>
        <Text style={[styles.eyebrow, { color: theme.muted }]}>LIVE PRICE</Text>
        <View style={[styles.badge, { borderColor: theme.line }]}>
          <Text style={[styles.eyebrow, { color: theme.accentText }]}>SINCE OPENED</Text>
        </View>
      </View>
      <Text style={[styles.caption, { color: theme.muted }]}>
        {points.length} price tick{points.length === 1 ? '' : 's'} received
      </Text>
      <View
        style={styles.chartFrame}
        accessible
        accessibilityLabel={
          chart
            ? `Price chart from ${money(chart.first.price)} to ${money(chart.last.price)}, ${points.length} received ticks`
            : available
              ? 'Waiting for price ticks'
              : 'No price data available'
        }
      >
        {chart ? (
          <Svg width="100%" height={180} viewBox="0 0 320 180" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.18} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {[45, 90, 135].map((y) => (
              <Line
                key={y}
                x1={0}
                x2={320}
                y1={y}
                y2={y}
                stroke={theme.line}
                strokeDasharray="3 6"
                strokeWidth={0.5}
              />
            ))}
            {points.length > 1 && (
              <>
                <Path d={chart.area} fill={`url(#${gradientId})`} />
                <Path
                  d={chart.line}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </>
            )}
            <Circle cx={chart.end.x} cy={chart.end.y} r={3} fill={color} />
          </Svg>
        ) : (
          <Text style={[styles.chartEmpty, { color: theme.muted }]}>
            {available
              ? 'Your chart starts with the next live price tick.'
              : 'No price available for this stock.\nA chart appears when live ticks arrive.'}
          </Text>
        )}
      </View>
      {chart && (
        <>
          <View style={styles.chartRange}>
            <Text style={[styles.caption, { color: theme.muted }]}>
              Low {money(chart.minimum)}
            </Text>
            <Text style={[styles.caption, { color: theme.muted }]}>
              High {money(chart.maximum)}
            </Text>
          </View>
          <View style={styles.chartTimes}>
            <Text style={[styles.caption, { color: theme.muted }]}>
              {clockTime(chart.first.receivedAt)}
            </Text>
            <Text style={[styles.caption, { color: theme.muted }]}>
              {clockTime(chart.last.receivedAt)}
            </Text>
          </View>
        </>
      )}
    </View>
  );
});
