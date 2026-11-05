import { useRef } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GradientButton } from '../../components/GradientButton';
import { loadMarket, useMarketStatus } from '../../state/market';
import { useTheme } from '../../theme/theme';
import { HoldingsList } from './HoldingsList';
import { PortfolioHeader, HEADER_FADE_DISTANCE } from './PortfolioHeader';
import { styles } from './styles';

export function PortfolioScreen() {
  const theme = useTheme();
  const status = useMarketStatus();
  const scrollY = useRef(new Animated.Value(0)).current;

  // Native scroll events drive opacity without a React state update per frame.
  // Web has no native animation driver; the same interpolation runs in JS there.
  const onScroll = useRef(
    Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
      useNativeDriver: Platform.OS !== 'web',
    }),
  ).current;
  const expandedOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_FADE_DISTANCE * 0.4, HEADER_FADE_DISTANCE],
    outputRange: [1, 0.65, 0],
    extrapolate: 'clamp',
  });

  const feedColor = status.paused || status.loading ? theme.accentText : theme.gain;
  let feedLabel = 'Simulated live prices';
  if (status.loading) feedLabel = 'Connecting to prices';
  else if (status.paused) feedLabel = 'Prices paused';

  const expandedHeader = (
    <>
      <View style={[styles.expandedHeader, { backgroundColor: theme.elevated }]}>
        <Animated.View style={{ opacity: expandedOpacity }}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Your portfolio</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>
              Every holding. One clear picture.
            </Text>
          </View>
          <View
            style={[
              styles.feed,
              { borderColor: theme.line, backgroundColor: theme.card },
            ]}
          >
            <View style={styles.feedLabel}>
              <View style={[styles.statusDot, { backgroundColor: feedColor }]} />
              <Text style={[styles.feedText, { color: feedColor }]}>{feedLabel}</Text>
            </View>
            <Text style={[styles.caption, { color: theme.muted }]}>NSE · INR</Text>
          </View>
        </Animated.View>
      </View>
      {status.error && (
        <View
          style={[
            styles.errorCard,
            { backgroundColor: theme.card, borderColor: theme.line },
          ]}
        >
          <Text style={[styles.metric, { color: theme.text }]}>
            Couldn't refresh prices
          </Text>
          <Text style={[styles.note, { color: theme.muted }]}>{status.error}</Text>
          <GradientButton
            label="Try again"
            onPress={() => {
              void loadMarket();
            }}
            theme={theme}
          />
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg }]}>
      <StatusBar style="light" />
      {/* This relative container anchors the overlay below the safe-area inset. */}
      <View style={styles.screen}>
        <HoldingsList theme={theme} onScroll={onScroll} expandedHeader={expandedHeader} />
        <PortfolioHeader theme={theme} scrollY={scrollY} />
      </View>
    </SafeAreaView>
  );
}
