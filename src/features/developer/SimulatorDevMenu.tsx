import { useEffect, useState } from 'react';
import {
  DevSettings,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SIMULATOR_TICK_RATES } from '../../feed/simulator';
import { subscribeToSimulatorMenu } from '../../state/developerMenu';
import {
  canForceSimulatorDisconnect,
  forceSimulatorDisconnect,
  setSimulatorTickRate,
  useMarketStatus,
  useSimulatorSettings,
} from '../../state/market';
import { useTheme } from '../../theme/theme';

const MENU_TITLE = 'Simulator controls';

export function SimulatorDevMenu() {
  const [visible, setVisible] = useState(false);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { tickRate } = useSimulatorSettings();
  const market = useMarketStatus();
  const canDisconnect = canForceSimulatorDisconnect();
  useEffect(() => {
    if (!__DEV__) return;
    const open = () => setVisible(true);
    const unsubscribe = subscribeToSimulatorMenu(open);
    if (Platform.OS !== 'web') DevSettings.addMenuItem(MENU_TITLE, open);
    return () => {
      unsubscribe();
      // DevSettings has no removeMenuItem. Replacing its handler removes the old
      // subscription and prevents calling setState after an unmount/Fast Refresh.
      if (Platform.OS !== 'web') DevSettings.addMenuItem(MENU_TITLE, () => {});
    };
  }, []);
  if (!__DEV__ || !visible) return null;
  const status = market.loading
    ? 'Connecting'
    : market.paused
      ? 'Prices paused'
      : 'Simulated live';
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.overlay}>
        <Pressable
          accessible={false}
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
          onPress={() => setVisible(false)}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.panel,
            {
              backgroundColor: theme.card,
              borderColor: theme.line,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <View style={styles.heading}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: theme.accentText }]}>
                DEVELOPMENT ONLY
              </Text>
              <Text style={[styles.title, { color: theme.text }]}>{MENU_TITLE}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close simulator controls"
              onPress={() => setVisible(false)}
              style={[styles.close, { borderColor: theme.line }]}
            >
              <Text style={[styles.buttonLabel, { color: theme.text }]}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} style={{ flexShrink: 1 }}>
            <View
              style={[
                styles.connection,
                { backgroundColor: theme.bg, borderColor: theme.line },
              ]}
            >
              <Text style={[styles.label, { color: theme.muted }]}>FEED STATUS</Text>
              <Text
                accessibilityLiveRegion="polite"
                style={[
                  styles.value,
                  {
                    color:
                      market.paused || market.loading ? theme.accentText : theme.gain,
                  },
                ]}
              >
                {status}
              </Text>
              {market.error && (
                <Text style={[styles.caption, { color: theme.muted }]}>
                  {market.error}
                </Text>
              )}
            </View>
            <View style={{ gap: 12 }}>
              <Text style={[styles.value, { color: theme.text }]}>Tick rate</Text>
              <Text style={[styles.caption, { color: theme.muted }]}>
                Aggregate updates per second across all symbols. Default: 20.
              </Text>
              <View style={styles.rates}>
                {SIMULATOR_TICK_RATES.map((rate) => (
                  <Pressable
                    key={rate}
                    accessibilityRole="button"
                    accessibilityLabel={`${rate} ticks per second`}
                    accessibilityState={{ selected: tickRate === rate }}
                    onPress={() => setSimulatorTickRate(rate)}
                    style={[
                      styles.rate,
                      {
                        borderColor: tickRate === rate ? theme.accentText : theme.line,
                        backgroundColor: tickRate === rate ? theme.accent : theme.bg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rateValue,
                        { color: tickRate === rate ? theme.accentText : theme.text },
                      ]}
                    >
                      {rate}
                    </Text>
                    <Text style={[styles.caption, { color: theme.muted }]}>ticks/s</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.caption, { color: theme.muted }]}>
                {tickRate} ticks/s selected. Applies immediately; retained through
                reconnects and refreshes until restart.
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.line }]} />
            <View style={{ gap: 12 }}>
              <Text style={[styles.value, { color: theme.text }]}>
                Connection recovery
              </Text>
              <Text style={[styles.caption, { color: theme.muted }]}>
                Force a five-second outage. The app retries automatically with backoff,
                then fetches a catch-up snapshot before resuming ticks.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Force simulator disconnect"
                accessibilityState={{ disabled: !canDisconnect }}
                disabled={!canDisconnect}
                onPress={forceSimulatorDisconnect}
                style={({ pressed }) => [
                  styles.disconnect,
                  {
                    backgroundColor: theme.destructiveSurface,
                    borderColor: theme.destructiveBorder,
                    opacity: !canDisconnect ? 0.4 : pressed ? 0.65 : 1,
                  },
                ]}
              >
                <Text style={[styles.buttonLabel, { color: theme.loss }]}>
                  Force disconnect
                </Text>
              </Pressable>
              <Text style={[styles.caption, { color: theme.muted }]}>
                Recovery normally takes about seven seconds plus fetch time. Rate changes
                do not reconnect a paused feed.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000099' },
  panel: {
    maxHeight: '90%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingTop: 24,
    flexShrink: 1,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingBottom: 22,
  },
  title: { fontSize: 23, fontWeight: '700', marginTop: 8, letterSpacing: -0.6 },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  close: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  body: { paddingHorizontal: 22, paddingBottom: 10, gap: 22 },
  connection: { padding: 16, borderRadius: 17, borderWidth: 1, gap: 8 },
  label: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  value: { fontSize: 15, fontWeight: '700' },
  caption: { fontSize: 11, lineHeight: 17 },
  rates: { flexDirection: 'row', gap: 8 },
  rate: {
    flex: 1,
    minHeight: 70,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  rateValue: { fontSize: 21, fontWeight: '700', fontVariant: ['tabular-nums'] },
  divider: { height: StyleSheet.hairlineWidth },
  disconnect: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLabel: { fontSize: 12, fontWeight: '700' },
});
