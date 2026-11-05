import { StyleSheet, View } from 'react-native';

/** Consistent native strokes, with no font baseline or platform glyph differences. */
export function TrashIcon({ color }: { color: string }) {
  return (
    <View accessible={false} style={styles.icon}>
      <View style={[styles.handle, { borderColor: color }]} />
      <View style={[styles.lid, { backgroundColor: color }]} />
      <View style={[styles.bin, { borderColor: color }]} />
      <View style={[styles.line, { left: 8, backgroundColor: color }]} />
      <View style={[styles.line, { right: 8, backgroundColor: color }]} />
    </View>
  );
}
const styles = StyleSheet.create({
  icon: { width: 24, height: 24 },
  handle: {
    position: 'absolute',
    left: 9,
    top: 3,
    width: 6,
    height: 4,
    borderWidth: 1.5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  lid: { position: 'absolute', left: 4, right: 4, top: 6, height: 1.5, borderRadius: 1 },
  bin: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 9,
    height: 12,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  line: { position: 'absolute', top: 11, height: 6, width: 1.5, borderRadius: 1 },
});
