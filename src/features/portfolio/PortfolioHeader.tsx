import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMarketStatus } from '../../state/market';
import type { Theme } from '../../theme/theme';
import { styles } from './styles';

// Reserve this space in the list so the first content starts below the toolbar.
export const TOOLBAR_HEIGHT = 64;
export const HEADER_FADE_DISTANCE = 140;

type Props = { scrollY: Animated.Value; theme: Theme };

/** A pinned toolbar whose dark backdrop fades in as the large header scrolls away. */
export function PortfolioHeader({ scrollY, theme }: Props) {
  const status = useMarketStatus();
  const statusLabel = status.loading
    ? 'CONNECTING'
    : status.paused
      ? 'PRICES PAUSED'
      : 'SIMULATED LIVE';
  const statusColor = status.paused || status.loading ? theme.accentText : theme.gain;
  const backdropOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_FADE_DISTANCE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={headerStyles.toolbar}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.bg, opacity: backdropOpacity },
        ]}
      />
      <View style={headerStyles.brandRow}>
        <View style={[styles.brandMark, { backgroundColor: theme.accent }]}>
          <Text style={[styles.brandLetter, { color: theme.accentText }]}>L</Text>
        </View>
        <Text style={[styles.brandName, { color: theme.text }]}>liquide</Text>
        <View style={[styles.tag, { borderColor: theme.line }]}>
          <Text style={[styles.tagLabel, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
      {/* A short gradient softens the edge where scrolling content disappears. */}
      <Animated.View
        pointerEvents="none"
        style={[headerStyles.fadeEdge, { opacity: backdropOpacity }]}
      >
        <LinearGradient
          colors={[theme.bg, 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  toolbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TOOLBAR_HEIGHT,
    zIndex: 10,
  },
  brandRow: {
    height: TOOLBAR_HEIGHT,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  fadeEdge: { position: 'absolute', left: 0, right: 0, bottom: -16, height: 16 },
});
