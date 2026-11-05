import { Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Theme } from '../theme/theme';

type Props = { label: string; onPress: () => void; theme: Theme };

/** Reusable warm action button, matching the reference's yellow-to-orange fill. */
export function GradientButton({ label, onPress, theme }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.8 : 1 }]}
    >
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientEnd]}
        style={styles.fill}
      >
        <Text style={[styles.label, { color: theme.buttonText }]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: { borderRadius: 20, overflow: 'hidden' },
  fill: {
    minHeight: 54,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 17, fontWeight: '800' },
});
