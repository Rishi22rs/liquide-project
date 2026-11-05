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
import { TrashIcon } from './TrashIcon';
import type { Theme } from '../theme/theme';

// Reveal only the monogram-width area so the stock name stays fully visible.
const ACTION_WIDTH = 52;
type Props = {
  children: ReactNode;
  label: string;
  accessibilityLabel: string;
  onRemove: () => void;
  theme: Theme;
};

/** Horizontal swipes reveal a deliberate remove action. Vertical gestures stay
 * with the list, and an accessible button provides the same action without swiping. */
export function SwipeToRemove({
  children,
  label,
  accessibilityLabel,
  onRemove,
  theme,
}: Props) {
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
    <View style={[styles.container, { borderBottomColor: theme.line }]}>
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[
          styles.actionContainer,
          {
            opacity: translateX.interpolate({
              inputRange: [-ACTION_WIDTH, -12, 0],
              outputRange: [1, 0, 0],
              extrapolate: 'clamp',
            }),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label} from watchlist`}
          disabled={!open}
          aria-hidden={!open}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'yes' : 'no-hide-descendants'}
          onPress={onRemove}
          style={({ pressed }) => [
            styles.remove,
            {
              backgroundColor: theme.destructiveSurface,
              borderColor: theme.destructiveBorder,
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <TrashIcon color={theme.loss} />
          <Text style={[styles.removeText, { color: theme.loss }]}>Remove</Text>
        </Pressable>
      </Animated.View>
      <Animated.View
        {...responder.panHandlers}
        style={{ backgroundColor: theme.bg, transform: [{ translateX }] }}
      >
        <Pressable
          accessible
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Swipe left or long press for the remove action."
          accessibilityActions={[
            { name: 'remove', label: `Remove ${label} from watchlist` },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'remove') onRemove();
          }}
          onLongPress={() => settle(true)}
          delayLongPress={350}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  // The separator stays full-width rather than moving with the swiped row.
  container: { overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth },
  actionContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  remove: {
    width: 44,
    height: 60,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  removeText: { fontSize: 9, fontWeight: '600', letterSpacing: 0.1 },
});
