import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Theme } from '../theme/theme';

type Props = { value: string; onChangeText: (value: string) => void; theme: Theme };

export function SearchField({ value, onChangeText, theme }: Props) {
  return (
    <View style={[styles.container, { borderColor: theme.inputBorder }]}>
      {/* Draw the search icon with native views to avoid platform-specific glyphs. */}
      <View accessible={false} style={styles.icon}>
        <View style={[styles.circle, { borderColor: theme.muted }]} />
        <View style={[styles.handle, { backgroundColor: theme.muted }]} />
      </View>
      <TextInput
        accessibilityLabel="Filter holdings by symbol"
        placeholder="Search for stocks"
        placeholderTextColor={theme.muted}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="characters"
        autoCorrect={false}
        selectionColor={theme.gold}
        style={[styles.input, { color: theme.text }]}
      />
      {value.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={8}
          style={styles.clear}
        >
          <Text style={{ color: theme.text, fontSize: 26 }}>×</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    minHeight: 66,
    borderWidth: 1,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 16,
  },
  input: { flex: 1, minWidth: 0, paddingVertical: 18, fontSize: 16, fontWeight: '600' },
  icon: { width: 21, height: 23 },
  circle: { width: 17, height: 17, borderRadius: 9, borderWidth: 2 },
  handle: {
    position: 'absolute',
    width: 9,
    height: 2,
    top: 17,
    left: 13,
    transform: [{ rotate: '45deg' }],
  },
  clear: { minHeight: 44, minWidth: 32, alignItems: 'center', justifyContent: 'center' },
});
