import { useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Theme } from '../theme/theme';

const ACTION_WIDTH = 84;
type Props = { children: ReactNode; label: string; onRemove: () => void; theme: Theme };

/** Horizontal swipes reveal a deliberate remove action. Vertical gestures stay
 * with the list, and an accessible button provides the same action without swiping. */
export function SwipeToRemove({ children, label, onRemove, theme }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const startingOffset = useRef(0);
  const currentOffset = useRef(0);
  const [open, setOpen] = useState(false);

  function settle(openAction: boolean) {
    const nextOffset = openAction ? -ACTION_WIDTH : 0;
    currentOffset.current = nextOffset;
    setOpen(openAction);
    Animated.spring(translateX, {
      toValue: nextOffset,
      useNativeDriver: Platform.OS !== 'web',
      speed: 24,
      bounciness: 0,
    }).start();
  }

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderGrant: () => {
        translateX.stopAnimation();
        startingOffset.current = currentOffset.current;
      },
      onPanResponderMove: (_, gesture) => {
        const nextOffset = Math.max(
          -ACTION_WIDTH,
          Math.min(0, startingOffset.current + gesture.dx),
        );
        currentOffset.current = nextOffset;
        translateX.setValue(nextOffset);
      },
      onPanResponderRelease: (_, gesture) =>
        settle(
          gesture.vx < -0.4 ||
            (gesture.vx <= 0.4 && currentOffset.current < -ACTION_WIDTH / 2),
        ),
      onPanResponderTerminate: () => settle(false),
    }),
  ).current;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label} from watchlist`}
        disabled={!open}
        aria-hidden={!open}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'yes' : 'no-hide-descendants'}
        onPress={onRemove}
        style={[styles.remove, { backgroundColor: theme.loss }]}
      >
        <Text style={styles.removeText}>Remove</Text>
      </Pressable>
      <Animated.View
        {...responder.panHandlers}
        style={{ backgroundColor: theme.bg, transform: [{ translateX }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  remove: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    right: 0,
    width: ACTION_WIDTH,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: { color: '#15090C', fontSize: 11, fontWeight: '800' },
});
