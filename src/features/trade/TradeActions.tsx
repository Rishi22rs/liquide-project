import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GradientButton } from '../../components/GradientButton';
import type { TradeSide } from '../../domain/trading';
import { useAvailableShares } from '../../state/holdings';
import { useQuote } from '../../state/market';
import type { Theme } from '../../theme/theme';

type Props = { symbol: string; onOpen: (side: TradeSide) => void; theme: Theme };

export function TradeActions({ symbol, onOpen, theme }: Props) {
  const availableShares = useAvailableShares(symbol);
  const quote = useQuote(symbol);
  const priced =
    quote?.ltp !== undefined && Number.isSafeInteger(quote.ltp) && quote.ltp > 0;
  const canSell = priced && availableShares > 0;
  return (
    <View
      style={[styles.container, { borderColor: theme.line, backgroundColor: theme.bg }]}
    >
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sell stock"
          disabled={!canSell}
          onPress={() => onOpen('sell')}
          style={({ pressed }) => [
            styles.sell,
            {
              backgroundColor: theme.card,
              borderColor: theme.line,
              opacity: !canSell ? 0.3 : pressed ? 0.65 : 1,
            },
          ]}
        >
          <Text style={[styles.sellLabel, { color: theme.text }]}>Sell</Text>
        </Pressable>
        <View style={styles.buy}>
          <GradientButton
            label="Buy stock"
            disabled={!priced}
            onPress={() => onOpen('buy')}
            theme={theme}
          />
        </View>
      </View>
      <Text style={[styles.note, { color: theme.muted }]}>
        {priced
          ? 'Simulated orders · No real money'
          : 'Price unavailable · Trading disabled'}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sell: {
    flex: 1,
    minHeight: 54,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellLabel: { fontSize: 17, fontWeight: '700' },
  buy: { flex: 1.7 },
  note: { fontSize: 10, textAlign: 'center', lineHeight: 15 },
});
