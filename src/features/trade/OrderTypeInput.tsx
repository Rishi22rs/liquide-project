import { Pressable, Text, TextInput, View } from 'react-native';
import type { TradeSide } from '../../domain/trading';
import type { Theme } from '../../theme/theme';
import { styles } from './styles';

export function OrderTypeInput({
  type,
  onTypeChange,
  value,
  onChange,
  error,
  side,
  theme,
  onInputFocus,
  onInputBlur,
}: {
  type: 'market' | 'limit';
  onTypeChange: (type: 'market' | 'limit') => void;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  side: TradeSide;
  theme: Theme;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>Order type</Text>
      <View style={[styles.tabs, { borderColor: theme.line, backgroundColor: theme.bg }]}>
        {(['market', 'limit'] as const).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={`${option === 'market' ? 'Market' : 'Limit'} order`}
            accessibilityState={{ selected: type === option }}
            onPress={() => onTypeChange(option)}
            style={[
              styles.tab,
              { backgroundColor: type === option ? theme.elevated : 'transparent' },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: type === option ? theme.accentText : theme.muted },
              ]}
            >
              {option === 'market' ? 'Market' : 'Limit'}
            </Text>
          </Pressable>
        ))}
      </View>
      {type === 'limit' && (
        <>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>Limit price (₹)</Text>
          <TextInput
            accessibilityLabel="Limit price in rupees"
            value={value}
            onChangeText={onChange}
            onFocus={onInputFocus}
            onBlur={onInputBlur}
            keyboardType="decimal-pad"
            inputMode="decimal"
            maxLength={20}
            placeholder="Enter your price"
            placeholderTextColor={theme.muted}
            style={{
              borderColor: error ? theme.loss : theme.line,
              borderWidth: 1,
              borderRadius: 14,
              padding: 15,
              color: theme.text,
              fontSize: 20,
              fontVariant: ['tabular-nums'],
            }}
          />
          <Text style={[styles.caption, { color: theme.muted }]}>
            Fills on a live tick {side === 'buy' ? 'at or below' : 'at or above'} this
            price. Session-only.
          </Text>
          {error && <Text style={[styles.error, { color: theme.loss }]}>{error}</Text>}
        </>
      )}
    </View>
  );
}
