import { memo, useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { Theme } from '../theme/theme';

type Props = {
  price: number | undefined;
  theme: Theme;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Animate only two small background layers, never the row layout or text.
 * Native opacity animations keep running on the UI thread between JS ticks. */
export const PriceFlash = memo(function PriceFlash({
  price,
  theme,
  children,
  style,
}: Props) {
  const up = useRef(new Animated.Value(0)).current;
  const down = useRef(new Animated.Value(0)).current;
  const previous = useRef(price);
  // Avoid flashing before the system accessibility preference is known.
  const reduceMotion = useRef(true);

  useEffect(() => {
    let mounted = true;
    let preferenceChanged = false;
    const applyPreference = (enabled: boolean) => {
      reduceMotion.current = enabled;
      if (enabled) {
        up.stopAnimation();
        down.stopAnimation();
        up.setValue(0);
        down.setValue(0);
      }
    };
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        preferenceChanged = true;
        applyPreference(enabled);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted && !preferenceChanged) applyPreference(enabled);
      })
      .catch(() => {
        /* Leave motion disabled if the preference cannot be read. */
      });
    return () => {
      mounted = false;
      subscription.remove();
      up.stopAnimation();
      down.stopAnimation();
    };
  }, [up, down]);

  useEffect(() => {
    const last = previous.current;
    previous.current = price;
    // Initial quotes, unavailable prices and volume-only updates never flash.
    if (
      price === undefined ||
      last === undefined ||
      price === last ||
      reduceMotion.current
    )
      return;
    up.stopAnimation();
    down.stopAnimation();
    up.setValue(0);
    down.setValue(0);
    const opacity = price > last ? up : down;
    opacity.setValue(0.18);
    Animated.timing(opacity, {
      toValue: 0,
      duration: 450,
      useNativeDriver: Platform.OS !== 'web',
      // A continuous market feed must not hold FlatList's interaction queue open.
      isInteraction: false,
    }).start();
  }, [price, up, down]);

  return (
    <View style={style}>
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        <Animated.View
          style={[styles.highlight, { backgroundColor: theme.gain, opacity: up }]}
        />
        <Animated.View
          style={[styles.highlight, { backgroundColor: theme.loss, opacity: down }]}
        />
      </View>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  highlight: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    left: -4,
    right: -4,
    borderRadius: 6,
  },
});
