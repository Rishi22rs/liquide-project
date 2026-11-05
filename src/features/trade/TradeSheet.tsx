import { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { GradientButton } from '../../components/GradientButton';
import { money } from '../../domain/portfolio';
import {
  parseTradeQuantity,
  validateTrade,
  type TradeFill,
  type TradeSide,
} from '../../domain/trading';
import { createTradeRequestId, tradingStore, useHolding } from '../../state/holdings';
import { loadMarket, useMarketStatus, useQuote } from '../../state/market';
import type { Theme } from '../../theme/theme';
import { QuantityInput } from './QuantityInput';
import { TradeReceipt } from './TradeReceipt';
import { styles } from './styles';

type Props = {
  symbol: string;
  initialSide: TradeSide;
  onClose: () => void;
  theme: Theme;
};

export function TradeSheet({ symbol, initialSide, onClose, theme }: Props) {
  const insets = useSafeAreaInsets();
  const quote = useQuote(symbol);
  const holding = useHolding(symbol);
  const market = useMarketStatus();
  const [side, setSide] = useState(initialSide);
  const [quantityText, setQuantityText] = useState('1');
  const [fill, setFill] = useState<TradeFill>();
  const [submitError, setSubmitError] = useState<string>();
  const [requestId] = useState(createTradeRequestId);
  const confirming = useRef(false);
  const quantity = parseTradeQuantity(quantityText);
  const validationError = validateTrade(side, quantity, holding, quote?.ltp);
  const currentPrice = quote?.ltp;
  const usablePrice =
    currentPrice !== undefined && Number.isSafeInteger(currentPrice) && currentPrice > 0;
  const estimate =
    quantity !== undefined && usablePrice && Number.isSafeInteger(quantity * currentPrice)
      ? quantity * currentPrice
      : undefined;
  const heldQuantity = holding?.qty ?? 0;

  function changeQuantity(value: string) {
    setQuantityText(value);
    setSubmitError(undefined);
  }

  function confirm() {
    if (confirming.current || quantity === undefined || validationError || fill) return;
    confirming.current = true;
    Keyboard.dismiss();
    // The store revalidates the quantity and reads the latest price at this instant.
    const result = tradingStore.submit({
      id: requestId,
      symbol,
      side,
      quantity,
    });
    if (result.ok) setFill(result.fill);
    else {
      setSubmitError(result.error);
      confirming.current = false;
    }
  }

  return (
    <Modal
      transparent
      animationType="slide"
      visible
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          accessible={false}
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          onPress={onClose}
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
        />
        <KeyboardAvoidingView
          pointerEvents="box-none"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboard}
        >
          <View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              { backgroundColor: theme.card, borderColor: theme.line },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: theme.line }]} />
            <View style={styles.heading}>
              <View>
                <Text style={[styles.title, { color: theme.text }]}>
                  {fill ? 'Order complete' : side === 'buy' ? 'Buy stock' : 'Sell stock'}
                </Text>
                <Text style={[styles.caption, { color: theme.muted, marginTop: 5 }]}>
                  Local simulation
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close trade sheet"
                onPress={onClose}
                style={[
                  styles.close,
                  { borderColor: theme.line, backgroundColor: theme.bg },
                ]}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  <Path
                    d="M6 6L18 18M18 6L6 18"
                    stroke={theme.text}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                  />
                </Svg>
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.scroll}
              contentContainerStyle={fill ? undefined : styles.body}
            >
              {fill ? (
                <TradeReceipt fill={fill} theme={theme} />
              ) : (
                <>
                  <View
                    style={[
                      styles.stock,
                      { backgroundColor: theme.bg, borderColor: theme.line },
                    ]}
                  >
                    <View style={[styles.monogram, { backgroundColor: theme.elevated }]}>
                      <Text style={[styles.symbol, { color: theme.accentText }]}>
                        {symbol.slice(0, 2)}
                      </Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.symbol, { color: theme.text }]}>{symbol}</Text>
                      <Text
                        style={[styles.caption, { color: theme.muted, marginTop: 4 }]}
                      >
                        {heldQuantity} shares held
                      </Text>
                    </View>
                    <View style={styles.right}>
                      <Text style={[styles.price, { color: theme.text }]}>
                        {money(quote?.ltp)}
                      </Text>
                      <Text
                        style={[
                          styles.caption,
                          {
                            color:
                              market.paused || market.loading
                                ? theme.accentText
                                : theme.gain,
                          },
                        ]}
                      >
                        {market.loading
                          ? 'Refreshing'
                          : market.paused
                            ? 'Prices paused'
                            : 'Simulated live'}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.tabs,
                      { borderColor: theme.line, backgroundColor: theme.bg },
                    ]}
                  >
                    {(['buy', 'sell'] as const).map((option) => (
                      <Pressable
                        key={option}
                        accessibilityRole="button"
                        accessibilityLabel={
                          option === 'buy' ? 'Choose buy' : 'Choose sell'
                        }
                        accessibilityState={{
                          selected: side === option,
                          disabled: option === 'sell' && heldQuantity === 0,
                        }}
                        disabled={option === 'sell' && heldQuantity === 0}
                        onPress={() => {
                          setSide(option);
                          changeQuantity('1');
                        }}
                        style={[
                          styles.tab,
                          {
                            backgroundColor:
                              side === option
                                ? option === 'buy'
                                  ? theme.accent
                                  : theme.destructiveSurface
                                : 'transparent',
                            opacity: option === 'sell' && heldQuantity === 0 ? 0.3 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabText,
                            {
                              color:
                                side === option
                                  ? option === 'buy'
                                    ? theme.accentText
                                    : theme.loss
                                  : theme.muted,
                            },
                          ]}
                        >
                          {option === 'buy' ? 'Buy' : 'Sell'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <QuantityInput
                    value={quantityText}
                    onChange={changeQuantity}
                    heldQuantity={heldQuantity}
                    side={side}
                    error={
                      quantity === undefined ||
                      (side === 'sell' && (quantity ?? 0) > heldQuantity)
                        ? validationError
                        : undefined
                    }
                    theme={theme}
                  />
                  <View style={[styles.estimate, { borderColor: theme.line }]}>
                    <View style={styles.estimateRow}>
                      <Text style={[styles.fieldLabel, { color: theme.muted }]}>
                        Estimated value
                      </Text>
                      <Text style={[styles.estimateValue, { color: theme.text }]}>
                        {money(estimate)}
                      </Text>
                    </View>
                    <Text style={[styles.caption, { color: theme.muted }]}>
                      The final fill uses the latest price when you confirm.
                    </Text>
                    {market.paused && usablePrice && (
                      <Text style={[styles.caption, { color: theme.accentText }]}>
                        Feed paused. The last received price will be used.
                      </Text>
                    )}
                    {!usablePrice && (
                      <>
                        <Text style={[styles.caption, { color: theme.loss }]}>
                          Price unavailable. Trading is disabled.
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            void loadMarket();
                          }}
                          style={styles.retry}
                        >
                          <Text style={[styles.retryText, { color: theme.accentText }]}>
                            Retry prices
                          </Text>
                        </Pressable>
                      </>
                    )}
                    {submitError && (
                      <Text
                        accessibilityLiveRegion="polite"
                        style={[styles.error, { color: theme.loss }]}
                      >
                        {submitError}
                      </Text>
                    )}
                    {validationError &&
                      quantity !== undefined &&
                      !(side === 'sell' && quantity > heldQuantity) &&
                      usablePrice && (
                        <Text style={[styles.error, { color: theme.loss }]}>
                          {validationError}
                        </Text>
                      )}
                  </View>
                </>
              )}
            </ScrollView>
            <View
              style={[
                styles.footer,
                { borderColor: theme.line, paddingBottom: Math.max(insets.bottom, 16) },
              ]}
            >
              <GradientButton
                label={fill ? 'Done' : side === 'buy' ? 'Confirm buy' : 'Confirm sell'}
                onPress={fill ? onClose : confirm}
                disabled={!fill && Boolean(validationError)}
                theme={theme}
              />
              <Text style={[styles.disclaimer, { color: theme.muted }]}>
                Paper trading only. No real money or broker orders.
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
