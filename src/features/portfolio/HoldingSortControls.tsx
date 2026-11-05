import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SortDirectionIcon } from '../../components/SortDirectionIcon';
import type { HoldingSortKey, SortDirection } from '../../domain/portfolio';
import type { Theme } from '../../theme/theme';

type Props = {
  sortKey: HoldingSortKey;
  direction: SortDirection;
  onSelect: (key: HoldingSortKey) => void;
  onToggleDirection: () => void;
  theme: Theme;
};

const SORT_OPTIONS: readonly { key: HoldingSortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'value', label: 'Value' },
  { key: 'pnl', label: 'P&L' },
];

export function HoldingSortControls({
  sortKey,
  direction,
  onSelect,
  onToggleDirection,
  theme,
}: Props) {
  const description =
    sortKey === 'name'
      ? direction === 'ascending'
        ? 'Name A–Z'
        : 'Name Z–A'
      : `${direction === 'ascending' ? 'Lowest' : 'Highest'} ${sortKey === 'pnl' ? 'P&L (₹)' : 'value'} first · Unpriced last`;

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <View
          style={[
            styles.options,
            { borderColor: theme.line, backgroundColor: theme.card },
          ]}
        >
          {SORT_OPTIONS.map((option) => {
            const selected = sortKey === option.key;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${option.label}`}
                accessibilityState={{ selected }}
                onPress={() => onSelect(option.key)}
                style={[
                  styles.option,
                  { backgroundColor: selected ? theme.elevated : 'transparent' },
                ]}
              >
                <Text
                  style={[
                    styles.label,
                    { color: selected ? theme.accentText : theme.muted },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sort ${direction === 'ascending' ? 'descending' : 'ascending'}`}
          onPress={onToggleDirection}
          accessibilityHint={`Currently ${direction}. Tap to reverse the order.`}
          style={({ pressed }) => [
            styles.direction,
            {
              borderColor: theme.line,
              backgroundColor: pressed ? theme.elevated : theme.card,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <SortDirectionIcon direction={direction} color={theme.accentText} />
        </Pressable>
      </View>
      <Text style={[styles.description, { color: theme.muted }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 14, gap: 9 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  options: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    alignItems: 'stretch',
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
  },
  option: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  label: { fontSize: 12, fontWeight: '700' },
  direction: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: { fontSize: 10, lineHeight: 15 },
});
