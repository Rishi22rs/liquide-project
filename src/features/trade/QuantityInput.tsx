import { Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { parseTradeQuantity, type TradeSide } from '../../domain/trading';
import type { Theme } from '../../theme/theme';
import { styles } from './styles';

type Props = {
  value: string;
  onChange: (value: string) => void;
  heldQuantity: number;
  side: TradeSide;
  error?: string;
  theme: Theme;
};

export function QuantityInput({
  value,
  onChange,
  heldQuantity,
  side,
  error,
  theme,
}: Props) {
  const quantity = parseTradeQuantity(value);
  return (
    <View>
      <View style={styles.quantityHeader}>
        <Text style={[styles.fieldLabel, { color: theme.text }]}>Quantity</Text>
        {side === 'sell' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sell all available shares"
            hitSlop={6}
            disabled={heldQuantity === 0}
            onPress={() => onChange(String(heldQuantity))}
            style={[styles.max, { backgroundColor: theme.elevated }]}
          >
            <Text style={[styles.caption, { color: theme.accentText }]}>
              Max {heldQuantity}
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.caption, { color: theme.muted }]}>Whole shares only</Text>
        )}
      </View>
      <View
        style={[
          styles.quantity,
          {
            borderColor: error ? theme.loss : theme.inputBorder,
            backgroundColor: theme.bg,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Decrease quantity"
          disabled={quantity === 1}
          onPress={() => onChange(String(Math.max(1, (quantity ?? 1) - 1)))}
          style={({ pressed }) => [
            styles.stepper,
            {
              backgroundColor: theme.elevated,
              opacity: quantity === 1 ? 0.3 : pressed ? 0.6 : 1,
            },
          ]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M6 12H18"
              stroke={theme.text}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
        <TextInput
          accessibilityLabel="Order quantity"
          accessibilityHint="Enter a positive whole number of shares"
          keyboardType="number-pad"
          inputMode="numeric"
          value={value}
          onChangeText={onChange}
          selectTextOnFocus
          selectionColor={theme.primary}
          style={[styles.input, { color: theme.text }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increase quantity"
          onPress={() => onChange(String((quantity ?? 0) + 1))}
          style={({ pressed }) => [
            styles.stepper,
            { backgroundColor: theme.elevated, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M6 12H18M12 6V18"
              stroke={theme.text}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      </View>
      {error && (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.error, { color: theme.loss }]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
