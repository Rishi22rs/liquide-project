import { memo, useId, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';
import {
  buildTickChart,
  chartPointCoordinate,
  type ChartPoint,
} from '../../domain/tickHistory';
import { chartTimeBounds } from '../../domain/chartInteraction';
import { money } from '../../domain/portfolio';
import type { Theme } from '../../theme/theme';
import { useChartInteraction } from './useChartInteraction';
import { styles } from './styles';

function clockTime(timestamp: number, precise = false): string {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return precise ? `${time}.${String(date.getMilliseconds()).padStart(3, '0')}` : time;
}

const webGestureStyle = { height: 180, touchAction: 'none' as const };
type Props = {
  points: readonly ChartPoint[];
  available: boolean;
  theme: Theme;
  onInteractionChange: (active: boolean) => void;
};

/** A data-only chart view. Feed/session ownership stays in LiveTickChart so the
 * rendering and gestures can also be exercised with isolated test inputs. */
export const InteractiveTickChart = memo(function InteractiveTickChart({
  points,
  available,
  theme,
  onInteractionChange,
}: Props) {
  const interaction = useChartInteraction(points, onInteractionChange);
  const { timeWindow, selected } = interaction;
  const [frameWidth, setFrameWidth] = useState(0);
  const fullBounds = interaction.referenceBounds ?? chartTimeBounds(points);
  const window = timeWindow ?? fullBounds;
  const visiblePoints = useMemo(
    () =>
      timeWindow
        ? points.filter(
            (point) =>
              point.receivedAt >= timeWindow.start && point.receivedAt <= timeWindow.end,
          )
        : points,
    [points, timeWindow],
  );
  const chart = useMemo(
    () => buildTickChart(visiblePoints, 320, 180, window),
    [visiblePoints, window?.start, window?.end],
  );
  const gradientId = useId().replace(/:/g, '');
  const color =
    !chart || chart.last.price === chart.first.price
      ? theme.accentText
      : chart.last.price > chart.first.price
        ? theme.gain
        : theme.loss;
  const selectedIndex = selected ? visiblePoints.indexOf(selected) : -1;
  const crosshair =
    selected && chart
      ? chartPointCoordinate(
          selected,
          chart.bounds,
          visiblePoints.length <= 1 ? 0.5 : selectedIndex / (visiblePoints.length - 1),
        )
      : undefined;
  const tooltipLeft = crosshair
    ? Math.max(0, Math.min(frameWidth - 118, (crosshair.x / 320) * frameWidth - 59))
    : 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <View style={styles.cardTop}>
        <Text style={[styles.eyebrow, { color: theme.muted }]}>LIVE PRICE</Text>
        {timeWindow || selected ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset chart view"
            onPress={interaction.reset}
            hitSlop={12}
            style={({ pressed }) => [
              styles.badge,
              { borderColor: theme.line, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.eyebrow, { color: theme.accentText }]}>RESET VIEW</Text>
          </Pressable>
        ) : (
          <View style={[styles.badge, { borderColor: theme.line }]}>
            <Text style={[styles.eyebrow, { color: theme.accentText }]}>
              SINCE OPENED
            </Text>
          </View>
        )}
      </View>
      <View style={chartStyles.readout}>
        <Text
          style={[
            chartStyles.readoutValue,
            { color: selected ? theme.text : theme.muted },
          ]}
        >
          {selected ? money(selected.price) : `${points.length} price ticks`}
        </Text>
        <Text style={[styles.caption, { color: theme.muted }]}>
          {selected ? clockTime(selected.receivedAt, true) : 'Received this session'}
        </Text>
      </View>
      <View
        ref={interaction.frameRef}
        collapsable={false}
        {...interaction.panHandlers}
        testID="interactive-price-chart"
        onLayout={(event) => setFrameWidth(event.nativeEvent.layout.width)}
        style={[styles.chartFrame, Platform.OS === 'web' ? webGestureStyle : undefined]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Interactive price chart"
        accessibilityHint="Drag to inspect recorded prices. Pinch with two fingers to zoom."
        accessibilityState={{ disabled: points.length === 0 }}
        accessibilityValue={{
          min: 0,
          max: Math.max(0, visiblePoints.length - 1),
          now: selectedIndex >= 0 ? selectedIndex : Math.max(0, visiblePoints.length - 1),
          text: selected
            ? `${money(selected.price)} at ${clockTime(selected.receivedAt, true)}`
            : `${points.length} received price ticks`,
        }}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, visiblePoints.length - 1)}
        aria-valuenow={
          selectedIndex >= 0 ? selectedIndex : Math.max(0, visiblePoints.length - 1)
        }
        aria-valuetext={
          selected
            ? `${money(selected.price)} at ${clockTime(selected.receivedAt, true)}`
            : `${points.length} received price ticks`
        }
        accessibilityActions={
          points.length
            ? [
                { name: 'increment', label: 'Next tick' },
                { name: 'decrement', label: 'Previous tick' },
              ]
            : []
        }
        onAccessibilityAction={(event) =>
          interaction.stepSelection(event.nativeEvent.actionName === 'increment' ? 1 : -1)
        }
      >
        {/* Children do not claim touches: the frame is the single gesture target. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {chart ? (
            <Svg
              width="100%"
              height={180}
              viewBox="0 0 320 180"
              preserveAspectRatio="none"
            >
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
              {visiblePoints.length > 1 && (
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
              {!crosshair && (
                <Circle cx={chart.end.x} cy={chart.end.y} r={3} fill={color} />
              )}
              {crosshair && (
                <>
                  <Line
                    x1={crosshair.x}
                    x2={crosshair.x}
                    y1={0}
                    y2={180}
                    stroke={theme.accentText}
                    strokeWidth={1}
                    strokeDasharray="3 4"
                  />
                  <Line
                    x1={0}
                    x2={320}
                    y1={crosshair.y}
                    y2={crosshair.y}
                    stroke={theme.muted}
                    strokeWidth={0.5}
                    strokeDasharray="2 5"
                  />
                  <Circle
                    cx={crosshair.x}
                    cy={crosshair.y}
                    r={7}
                    fill={theme.accentText}
                    fillOpacity={0.15}
                  />
                  <Circle
                    cx={crosshair.x}
                    cy={crosshair.y}
                    r={3.5}
                    fill={theme.accentText}
                    stroke={theme.card}
                    strokeWidth={1.5}
                  />
                </>
              )}
            </Svg>
          ) : (
            <View style={chartStyles.empty}>
              <Text style={[styles.chartEmpty, { color: theme.muted }]}>
                {points.length > 0
                  ? 'No recorded ticks in this time range.\nZoom out to see more.'
                  : available
                    ? 'Your chart starts with the next live price tick.'
                    : 'No price available for this stock.\nA chart appears when live ticks arrive.'}
              </Text>
            </View>
          )}
          {selected && crosshair && (
            <View
              style={[
                chartStyles.tooltip,
                {
                  left: tooltipLeft,
                  backgroundColor: theme.elevated,
                  borderColor: theme.line,
                },
              ]}
            >
              <Text style={[chartStyles.tooltipPrice, { color: theme.text }]}>
                {money(selected.price)}
              </Text>
              <Text style={[chartStyles.tooltipTime, { color: theme.muted }]}>
                {clockTime(selected.receivedAt, true)}
              </Text>
            </View>
          )}
        </View>
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
              {clockTime(window!.start)}
            </Text>
            <Text style={[styles.caption, { color: theme.muted }]}>
              {clockTime(window!.end)}
            </Text>
          </View>
        </>
      )}
      <Text style={[chartStyles.help, { color: theme.muted }]}>
        Pinch to zoom · Touch and drag to inspect
      </Text>
    </View>
  );
});
const chartStyles = StyleSheet.create({
  readout: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  readoutValue: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tooltip: {
    position: 'absolute',
    top: 5,
    width: 118,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    gap: 3,
  },
  tooltipPrice: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tooltipTime: { fontSize: 9, fontVariant: ['tabular-nums'] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  help: { fontSize: 9, textAlign: 'center', marginTop: 12, lineHeight: 15 },
});
