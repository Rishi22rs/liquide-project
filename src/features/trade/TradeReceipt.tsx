import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { money } from '../../domain/portfolio';
import type { TradeFill } from '../../domain/trading';
import type { Theme } from '../../theme/theme';
import { styles } from './styles';

/** Receipt values are captured from the fill, so a later tick cannot change them. */
export function TradeReceipt({ fill, theme }: { fill: TradeFill; theme: Theme }) {
  return (
    <View style={styles.receipt}>
      <View style={[styles.successIcon, { backgroundColor: theme.accent }]}>
        <Svg width={28} height={28} viewBox="0 0 24 24">
          <Path
            d="M5 12L10 17L19 7"
            fill="none"
            stroke={theme.gain}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <View>
        <Text style={[styles.receiptTitle, { color: theme.text }]}>
          {fill.side === 'buy' ? 'Bought' : 'Sold'} {fill.quantity} {fill.symbol} share
          {fill.quantity === 1 ? '' : 's'}
        </Text>
        <Text style={[styles.disclaimer, { color: theme.muted, marginTop: 10 }]}>
          Simulated order filled · No real order placed
        </Text>
      </View>
      <View
        style={[
          styles.receiptCard,
          { borderColor: theme.line, backgroundColor: theme.bg },
        ]}
      >
        <View style={styles.estimateRow}>
          <Text style={[styles.caption, { color: theme.muted }]}>Filled price</Text>
          <Text style={[styles.receiptValue, { color: theme.text }]}>
            {money(fill.pricePaise)}
          </Text>
        </View>
        <View style={styles.estimateRow}>
          <Text style={[styles.caption, { color: theme.muted }]}>Total value</Text>
          <Text style={[styles.receiptValue, { color: theme.text }]}>
            {money(fill.valuePaise)}
          </Text>
        </View>
        <View style={styles.estimateRow}>
          <Text style={[styles.caption, { color: theme.muted }]}>
            Position after fill
          </Text>
          <Text style={[styles.receiptValue, { color: theme.text }]}>
            {fill.remainingQuantity} shares
          </Text>
        </View>
        {fill.averagePricePaise !== undefined && (
          <View style={styles.estimateRow}>
            <Text style={[styles.caption, { color: theme.muted }]}>Average price</Text>
            <Text style={[styles.receiptValue, { color: theme.text }]}>
              {money(fill.averagePricePaise)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
