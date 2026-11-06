import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useThemeMode } from '../state/themePreference';
import { useThemeTransition } from '../theme/ThemeTransitionContext';
import { useTheme } from '../theme/theme';

/** One compact switch replaces the live-status pill; both glyphs stay visible
 * so the current appearance and the alternative are clear without a text label. */
export function ThemeToggle() {
  const mode = useThemeMode();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const { busy, toggleAt } = useThemeTransition();
  const theme = useTheme();
  return (
    <Pressable
      ref={anchor}
      disabled={busy}
      accessibilityRole="switch"
      aria-checked={mode === 'dark'}
      accessibilityLabel="Dark mode"
      accessibilityState={{ checked: mode === 'dark', disabled: busy }}
      accessibilityHint={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
      onPress={() => toggleAt(anchor)}
      style={[styles.switch, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <View
        style={[
          styles.option,
          { backgroundColor: mode === 'light' ? theme.accent : 'transparent' },
        ]}
      >
        <Svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke={mode === 'light' ? theme.accentText : theme.muted}
          strokeWidth={1.7}
          strokeLinecap="round"
        >
          <Circle cx={12} cy={12} r={3.5} />
          <Path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </Svg>
      </View>
      <View
        style={[
          styles.option,
          { backgroundColor: mode === 'dark' ? theme.accent : 'transparent' },
        ]}
      >
        <Svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke={mode === 'dark' ? theme.accentText : theme.muted}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />
        </Svg>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  switch: {
    width: 84,
    height: 44,
    padding: 5,
    borderWidth: 1,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  option: {
    width: 34,
    height: 32,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
