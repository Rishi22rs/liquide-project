import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Theme } from '../../theme/theme';

type Props = {
  zoom: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  canReset: boolean;
  onZoom: (factor: number) => void;
  onReset: () => void;
  theme: Theme;
};

export function ChartZoomControls({
  zoom,
  canZoomIn,
  canZoomOut,
  canReset,
  onZoom,
  onReset,
  theme,
}: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.group, { borderColor: theme.line }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zoom out chart"
          disabled={!canZoomOut}
          onPress={() => onZoom(0.5)}
          style={({ pressed }) => [
            styles.button,
            { opacity: !canZoomOut ? 0.3 : pressed ? 0.6 : 1 },
          ]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M6 12H18"
              fill="none"
              stroke={theme.text}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
        <Text style={[styles.zoom, { color: theme.muted }]}>{zoom.toFixed(1)}×</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zoom in chart"
          disabled={!canZoomIn}
          onPress={() => onZoom(2)}
          style={({ pressed }) => [
            styles.button,
            { opacity: !canZoomIn ? 0.3 : pressed ? 0.6 : 1 },
          ]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M6 12H18M12 6V18"
              fill="none"
              stroke={theme.text}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reset chart view"
        disabled={!canReset}
        onPress={onReset}
        style={({ pressed }) => [
          styles.reset,
          {
            borderColor: theme.line,
            backgroundColor: theme.card,
            opacity: !canReset ? 0.35 : pressed ? 0.6 : 1,
          },
        ]}
      >
        <Text style={[styles.resetLabel, { color: theme.accentText }]}>Reset</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 12,
  },
  group: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 13 },
  button: { width: 44, height: 42, justifyContent: 'center', alignItems: 'center' },
  zoom: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 38,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  reset: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
  },
  resetLabel: { fontSize: 11, fontWeight: '600' },
});
