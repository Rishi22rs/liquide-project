import { StyleSheet, View } from 'react-native';
import type { SortDirection } from '../domain/portfolio';

type Props = { direction: SortDirection; color: string };

/** Fixed-size native strokes avoid font-dependent arrow shape and baseline drift. */
export function SortDirectionIcon({ direction, color }: Props) {
  const ascending = direction === 'ascending';
  const barWidths = ascending ? [4, 7, 10] : [10, 7, 4];

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.icon}
    >
      <View style={styles.bars}>
        {barWidths.map((width, index) => (
          <View key={index} style={[styles.bar, { width, backgroundColor: color }]} />
        ))}
      </View>
      <View
        style={[styles.arrow, { transform: [{ rotate: ascending ? '180deg' : '0deg' }] }]}
      >
        <View style={[styles.shaft, { backgroundColor: color }]} />
        <View style={[styles.chevron, { borderColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 22,
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bars: { height: 14, justifyContent: 'space-between', width: 10 },
  bar: { height: 2, borderRadius: 1 },
  arrow: { width: 8, height: 20 },
  shaft: { position: 'absolute', left: 3, top: 3, width: 2, height: 13, borderRadius: 1 },
  chevron: {
    position: 'absolute',
    left: 1,
    bottom: 3,
    width: 6,
    height: 6,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
});
