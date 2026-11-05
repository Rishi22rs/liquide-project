import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LimitOrders } from '../trade/LimitOrders';
import { TradeActions } from '../trade/TradeActions';
import { TradeSheet } from '../trade/TradeSheet';
import type { TradeSide } from '../../domain/trading';
import type { RootStackParams } from '../../navigation/types';
import { SYMBOLS } from '../../data/holdings';
import { dayChange, money, percent } from '../../domain/portfolio';
import { loadMarket, useMarketStatus, useQuote } from '../../state/market';
import { useWatchlist, watchlistStore } from '../../state/watchlist';
import { useTheme } from '../../theme/theme';
import { LiveTickChart } from './LiveTickChart';
import { StockStatistics } from './StockStatistics';
import { StockPosition } from './StockPosition';
import { styles } from './styles';

type Props = NativeStackScreenProps<RootStackParams, 'StockDetail'>;

export function StockDetailScreen({ route, navigation }: Props) {
  const { symbol } = route.params;
  const theme = useTheme();
  const [chartInteracting, setChartInteracting] = useState(false);
  const [tradeSide, setTradeSide] = useState<TradeSide>();
  const quote = useQuote(symbol);
  const status = useMarketStatus();
  const watchlist = useWatchlist();
  const saved = watchlist.symbols.includes(symbol);
  const canWatch = SYMBOLS.some((item) => item === symbol);
  const change = dayChange(quote);
  const changeColor =
    change.amount === undefined
      ? theme.muted
      : change.amount >= 0
        ? theme.gain
        : theme.loss;
  const statusColor = status.paused || status.loading ? theme.accentText : theme.gain;
  const statusLabel = status.loading
    ? 'Connecting'
    : status.paused
      ? 'Prices paused'
      : 'Simulated live';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg }]}>
      <StatusBar style="light" />
      <View style={[styles.toolbar, { borderColor: theme.line }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to stocks"
          onPress={() => navigation.goBack()}
          style={styles.back}
        >
          <View style={[styles.backIcon, { borderColor: theme.text }]} />
        </Pressable>
        <View style={styles.toolbarIdentity}>
          <Text style={[styles.toolbarTitle, { color: theme.text }]}>{symbol}</Text>
          <View style={styles.status}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        {canWatch && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              saved ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`
            }
            disabled={!watchlist.hydrated || watchlist.loadFailed}
            onPress={() =>
              saved ? watchlistStore.remove(symbol) : watchlistStore.add(symbol)
            }
            style={({ pressed }) => [
              styles.watchButton,
              {
                borderColor: theme.line,
                backgroundColor: saved ? theme.accent : theme.card,
                opacity: pressed ? 0.65 : 1,
              },
            ]}
          >
            <Text style={[styles.watchLabel, { color: theme.accentText }]}>
              {saved ? 'Saved' : '+ Watch'}
            </Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        scrollEnabled={!chartInteracting}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={status.loading}
            onRefresh={() => {
              void loadMarket();
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <View style={styles.identity}>
          <View
            style={[
              styles.monogram,
              { backgroundColor: theme.elevated, borderColor: theme.line },
            ]}
          >
            <Text style={[styles.monogramLabel, { color: theme.accentText }]}>
              {symbol.slice(0, 2)}
            </Text>
          </View>
          <View>
            <Text style={[styles.symbol, { color: theme.text }]}>{symbol}</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>NSE · Equity</Text>
          </View>
        </View>
        <View style={styles.priceSection}>
          <Text style={[styles.eyebrow, { color: theme.muted }]}>LAST TRADED PRICE</Text>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[styles.price, { color: theme.text }]}
          >
            {money(quote?.ltp)}
          </Text>
          <View style={styles.priceMeta}>
            <Text style={[styles.change, { color: changeColor }]}>
              {money(change.amount)} ({percent(change.percentage)}) today
            </Text>
            <Text style={[styles.caption, { color: theme.muted }]}>NSE · INR</Text>
          </View>
        </View>
        {status.error && (
          <View
            style={[
              styles.error,
              { borderColor: theme.line, backgroundColor: theme.card },
            ]}
          >
            <Text style={[styles.caption, { color: theme.muted }]}>{status.error}</Text>
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
          </View>
        )}
        {watchlist.error && (
          <View
            style={[
              styles.error,
              { borderColor: theme.line, backgroundColor: theme.card },
            ]}
          >
            <Text style={[styles.caption, { color: theme.muted }]}>
              {watchlist.error}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={watchlistStore.retry}
              style={styles.retry}
            >
              <Text style={[styles.retryText, { color: theme.accentText }]}>
                Retry watchlist
              </Text>
            </Pressable>
          </View>
        )}
        {status.loading && !quote ? (
          <ActivityIndicator
            accessibilityLabel="Loading stock prices"
            color={theme.primary}
          />
        ) : null}
        {!status.loading && quote?.ltp === undefined && (
          <View style={[styles.unavailable, { backgroundColor: theme.accent }]}>
            <Text style={[styles.caption, { color: theme.accentText }]}>
              A price is unavailable for {symbol}. Values stay blank until a quote is
              received.
            </Text>
          </View>
        )}
        <LiveTickChart
          key={symbol}
          symbol={symbol}
          onInteractionChange={setChartInteracting}
          available={quote?.ltp !== undefined}
          theme={theme}
        />
        <StockStatistics quote={quote} theme={theme} />
        <StockPosition symbol={symbol} quote={quote} theme={theme} />
        <LimitOrders symbol={symbol} theme={theme} />
      </ScrollView>
      <TradeActions symbol={symbol} onOpen={setTradeSide} theme={theme} />
      {tradeSide && (
        <TradeSheet
          symbol={symbol}
          initialSide={tradeSide}
          onClose={() => setTradeSide(undefined)}
          theme={theme}
        />
      )}
    </SafeAreaView>
  );
}
