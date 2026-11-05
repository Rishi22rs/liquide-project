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
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { GradientButton } from '../../components/GradientButton';
import { money } from '../../domain/portfolio';
import {
  parseTradeQuantity,
  parseLimitPrice,
  validateTrade,
  type TradeFill,
  type TradeSide,
} from '../../domain/trading';
import {
  createTradeRequestId,
  tradingStore,
  useHolding,
  useAvailableShares,
  useLimitOrders,
} from '../../state/holdings';
import { loadMarket, useMarketStatus, useQuote } from '../../state/market';
import type { Theme } from '../../theme/theme';
import { OrderTypeInput } from './OrderTypeInput';
import { LimitOrderStatus } from './LimitOrders';
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
  const { height: windowHeight } = useWindowDimensions();
  // Capture the open height once. Android's modal window shrinks for the
  // keyboard, so recalculating from that smaller window would shrink it twice.
  const openHeight = useRef(Math.max(1, windowHeight - insets.top - 12)).current;
  const inputFocused = useRef(false);

  function dismissBackdrop() {
    // The first outside tap while editing closes only the keyboard. Keep the
    // draft mounted instead of replaying the modal's slide animation.
    if (inputFocused.current || Keyboard.isVisible()) Keyboard.dismiss();
    else onClose();
  }
  const quote = useQuote(symbol);
  const holding = useHolding(symbol);
  const availableShares = useAvailableShares(symbol);
  const orders = useLimitOrders();
  const market = useMarketStatus();
  const [side, setSide] = useState(initialSide);
  const [quantityText, setQuantityText] = useState('1');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [limitText, setLimitText] = useState(() =>
    quote?.ltp === undefined ? '' : (quote.ltp / 100).toFixed(2),
  );
  const [placedOrderId, setPlacedOrderId] = useState<string>();
  const placedOrder = orders.find((order) => order.id === placedOrderId);
  const limitPrice = parseLimitPrice(limitText);
  const limitError =
    orderType === 'limit' && limitPrice === undefined
      ? 'Enter a positive price with at most two decimal places.'
      : undefined;
  const [fill, setFill] = useState<TradeFill>();
  const [submitError, setSubmitError] = useState<string>();
  const [requestId] = useState(createTradeRequestId);
  const confirming = useRef(false);
  const quantity = parseTradeQuantity(quantityText);
  const validationHolding =
    side === 'sell' && holding ? { ...holding, qty: availableShares } : holding;
  const orderPrice = orderType === 'limit' ? limitPrice : quote?.ltp;
  const validationError =
    limitError ?? validateTrade(side, quantity, validationHolding, orderPrice);
  const currentPrice = quote?.ltp;
  const usablePrice =
    currentPrice !== undefined && Number.isSafeInteger(currentPrice) && currentPrice > 0;
  const estimate =
    quantity !== undefined &&
    orderPrice !== undefined &&
    Number.isSafeInteger(quantity * orderPrice)
      ? quantity * orderPrice
      : undefined;
  const heldQuantity = holding?.qty ?? 0;

  function changeQuantity(value: string) {
    setQuantityText(value);
    setSubmitError(undefined);
  }

  function confirm() {
    if (
      confirming.current ||
      quantity === undefined ||
      validationError ||
      fill ||
      placedOrder
    )
      return;
    confirming.current = true;
    Keyboard.dismiss();
    if (orderType === 'limit') {
      if (limitPrice === undefined) {
        confirming.current = false;
        return;
      }
      const result = tradingStore.placeLimit({
        id: requestId,
        symbol,
        side,
        quantity,
        limitPricePaise: limitPrice,
      });
      if (result.ok) setPlacedOrderId(result.order.id);
      else {
        setSubmitError(result.error);
        confirming.current = false;
      }
      return;
    }
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
          onPress={dismissBackdrop}
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
        />
        <KeyboardAvoidingView
          pointerEvents="box-none"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          enabled={Platform.OS === 'ios'}
          style={styles.keyboard}
        >
          <View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              { maxHeight: openHeight },
              !fill && !placedOrder ? { height: openHeight } : undefined,
              { backgroundColor: theme.card, borderColor: theme.line },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: theme.line }]} />
            <View style={styles.heading}>
              <View>
                <Text style={[styles.title, { color: theme.text }]}>
                  {fill
                    ? 'Order complete'
                    : placedOrder
                      ? placedOrder.status === 'pending'
                        ? 'Limit order placed'
                        : placedOrder.status === 'filled'
                          ? 'Order complete'
                          : 'Order updated'
                      : side === 'buy'
                        ? 'Buy stock'
                        : 'Sell stock'}
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
              keyboardDismissMode="none"
              style={[
                styles.scroll,
                !fill && !placedOrder ? styles.formScroll : undefined,
              ]}
              contentContainerStyle={fill || placedOrder ? undefined : styles.body}
            >
              {fill ? (
                <TradeReceipt fill={fill} theme={theme} />
              ) : placedOrder ? (
                <View style={{ padding: 22 }}>
                  <LimitOrderStatus order={placedOrder} theme={theme} />
                </View>
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
                        {heldQuantity} shares held · {availableShares} available
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
                          disabled: option === 'sell' && availableShares === 0,
                        }}
                        disabled={option === 'sell' && availableShares === 0}
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
                            opacity: option === 'sell' && availableShares === 0 ? 0.3 : 1,
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
                  <OrderTypeInput
                    type={orderType}
                    onInputFocus={() => {
                      inputFocused.current = true;
                    }}
                    onInputBlur={() => {
                      inputFocused.current = false;
                    }}
                    onTypeChange={(type) => {
                      setOrderType(type);
                      setSubmitError(undefined);
                    }}
                    value={limitText}
                    onChange={(text) => {
                      setLimitText(text);
                      setSubmitError(undefined);
                    }}
                    error={limitError}
                    side={side}
                    theme={theme}
                  />
                  <QuantityInput
                    value={quantityText}
                    onFocus={() => {
                      inputFocused.current = true;
                    }}
                    onBlur={() => {
                      inputFocused.current = false;
                    }}
                    onChange={changeQuantity}
                    heldQuantity={availableShares}
                    side={side}
                    error={
                      quantity === undefined ||
                      (side === 'sell' && (quantity ?? 0) > availableShares)
                        ? validationError
                        : undefined
                    }
                    theme={theme}
                  />
                  <View style={[styles.estimate, { borderColor: theme.line }]}>
                    <View style={styles.estimateRow}>
                      <Text style={[styles.fieldLabel, { color: theme.muted }]}>
                        {orderType === 'limit'
                          ? 'Value at limit price'
                          : 'Estimated value'}
                      </Text>
                      <Text style={[styles.estimateValue, { color: theme.text }]}>
                        {money(estimate)}
                      </Text>
                    </View>
                    <Text style={[styles.caption, { color: theme.muted }]}>
                      {orderType === 'limit'
                        ? 'Waits for the next eligible live tick. Fills at that tick’s price, which may be better than your limit.'
                        : 'The final fill uses the latest price when you confirm.'}
                    </Text>
                    {market.paused && usablePrice && (
                      <Text style={[styles.caption, { color: theme.accentText }]}>
                        {orderType === 'limit'
                          ? 'Feed paused. This order will wait for live ticks to resume.'
                          : 'Feed paused. The last received price will be used.'}
                      </Text>
                    )}
                    {!usablePrice && (
                      <>
                        <Text style={[styles.caption, { color: theme.loss }]}>
                          {orderType === 'limit'
                            ? 'Live price unavailable. This limit order will wait for a valid live tick.'
                            : 'Price unavailable. Trading is disabled.'}
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
                      !limitError &&
                      quantity !== undefined &&
                      !(side === 'sell' && quantity > availableShares) &&
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
                label={
                  fill || placedOrder
                    ? 'Done'
                    : orderType === 'limit'
                      ? 'Place limit order'
                      : side === 'buy'
                        ? 'Confirm buy'
                        : 'Confirm sell'
                }
                onPress={fill || placedOrder ? onClose : confirm}
                disabled={!fill && !placedOrder && Boolean(validationError)}
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
