import React, { memo, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { HOLDINGS } from './src/data/holdings';
import { money, percent, position, summarize, type Holding } from './src/domain/portfolio';
import { loadMarket, stopMarket, useMarketStatus, useQuote, useQuotes } from './src/state/market';

type Theme = typeof light;
const light = { bg: '#F5F6F8', card: '#FFFFFF', text: '#152C28', muted: '#667771', line: '#E5EBE8', gain: '#087E5B', loss: '#C13D49', accent: '#DDF5EB' };
const dark: Theme = { bg: '#0C1715', card: '#14241F', text: '#F0F7F3', muted: '#A0B6AC', line: '#293F36', gain: '#6EE7B7', loss: '#FF8F9C', accent: '#203E32' };
const Row = memo(function Row({ holding, theme }: { holding: Holding; theme: Theme }) {
  const quote = useQuote(holding.symbol);
  const row = position(holding, quote);
  return <View style={[styles.row, { borderColor: theme.line }]}>
    <View style={[styles.monogram, { backgroundColor: theme.accent }]}><Text style={{ color: theme.gain, fontWeight: '700' }}>{holding.symbol.slice(0, 2)}</Text></View>
    <View style={styles.flex}><Text style={[styles.symbol, { color: theme.text }]}>{holding.symbol}</Text>
      <Text style={[styles.caption, { color: theme.muted }]}>{holding.qty} shares · Avg {money(holding.avgPricePaise)}</Text>
      <Text style={[styles.caption, { color: theme.muted }]}>Last {money(quote?.ltp)}</Text></View>
    <View style={styles.right}><Text style={[styles.symbol, { color: theme.text }]}>{money(row.value)}</Text>
      <Text style={[styles.caption, { color: row.pnl === undefined ? theme.muted : row.pnl >= 0 ? theme.gain : theme.loss }]}>{money(row.pnl)} ({percent(row.pnlPercent)})</Text></View>
  </View>;
});
function Summary({ theme }: { theme: Theme }) {
  const quotes = useQuotes();
  const s = summarize(HOLDINGS, quotes);
  const hasPrices = s.missing < HOLDINGS.length;
  return <View style={[styles.summary, { backgroundColor: theme.card, borderColor: theme.line }]}>
    <Text style={[styles.eyebrow, { color: theme.muted }]}>PRICED HOLDINGS VALUE</Text>
    <Text style={[styles.total, { color: theme.text }]}>{money(hasPrices ? s.value : undefined)}</Text>
    <View style={styles.metrics}>
      <View style={styles.flex}><Text style={[styles.caption, { color: theme.muted }]}>Total invested · all holdings</Text><Text style={[styles.metric, { color: theme.text }]}>{money(s.invested)}</Text></View>
      <View style={styles.flex}><Text style={[styles.caption, { color: theme.muted }]}>Total P&L · priced holdings</Text><Text style={[styles.metric, { color: s.pnl >= 0 ? theme.gain : theme.loss }]}>{money(hasPrices ? s.pnl : undefined)}</Text><Text style={{ color: theme.muted }}>{percent(s.pnlPercent)}</Text></View>
    </View>
    <View style={[styles.day, { borderColor: theme.line }]}><Text style={{ color: theme.muted }}>Today's P&L</Text><Text style={{ color: s.dayPnl >= 0 ? theme.gain : theme.loss }}>{money(s.missingDay < HOLDINGS.length ? s.dayPnl : undefined)} ({percent(s.dayPercent)})</Text></View>
    {s.missing > 0 && <Text style={[styles.note, { color: theme.muted }]}>{s.missing} holding{s.missing > 1 ? 's' : ''} without a price excluded from value and total P&L. Invested includes all holdings.</Text>}
    {s.missingDay > s.missing && <Text style={[styles.note, { color: theme.muted }]}>{s.missingDay} holdings excluded from today's P&L because price or previous close is missing.</Text>}
  </View>;
}
// This child does not subscribe to quotes: stable list data prevents parent updates on ticks.
function Holdings({ theme }: { theme: Theme }) {
  const [query, setQuery] = useState('');
  const status = useMarketStatus();
  const data = useMemo(() => HOLDINGS.filter(h => h.symbol.includes(query.trim().toUpperCase())), [query]);
  return <FlatList data={data} keyExtractor={h => h.symbol} renderItem={({ item }) => <Row holding={item} theme={theme} />}
    contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={status.loading} onRefresh={() => { void loadMarket(); }} tintColor={theme.gain} />}
    ListHeaderComponent={<><Summary theme={theme} /><View style={styles.section}><Text style={[styles.heading, { color: theme.text }]}>Your holdings</Text><Text style={{ color: theme.muted }}>{HOLDINGS.length} positions</Text></View>
      <TextInput accessibilityLabel="Filter holdings by symbol" placeholder="Search a symbol" placeholderTextColor={theme.muted} value={query} onChangeText={setQuery} autoCapitalize="characters" style={[styles.search, { backgroundColor: theme.card, color: theme.text, borderColor: theme.line }]} />
      <View style={styles.section}><Text style={[styles.caption, { color: theme.muted }]}>SYMBOL / POSITION</Text><Text style={[styles.caption, { color: theme.muted }]}>VALUE / P&L</Text></View></>}
    ListEmptyComponent={<Text style={[styles.empty, { color: theme.muted }]}>No holdings match “{query}”.</Text>} />;
}
export default function App() {
  const theme = useColorScheme() === 'dark' ? dark : light;
  const status = useMarketStatus();
  useEffect(() => { void loadMarket(); return stopMarket; }, []);
  return <View style={[styles.screen, { backgroundColor: theme.bg }]}><StatusBar style="auto" />
    <View style={styles.header}><View><Text style={[styles.eyebrow, { color: theme.gain }]}>LIQUIDE / LIVE PORTFOLIO</Text><Text style={[styles.title, { color: theme.text }]}>Your money, in motion.</Text></View></View>
    <View style={[styles.feed, { backgroundColor: theme.accent }]}><Text style={{ color: theme.text }}>{status.loading ? 'Connecting to price service…' : status.paused ? '● Prices paused' : '● Live simulated prices'}</Text><Text style={{ color: theme.muted }}>20 ticks / sec</Text></View>
    {status.error ? <View style={styles.empty}><Text style={{ color: theme.loss }}>{status.error}</Text><Pressable accessibilityRole="button" onPress={() => { void loadMarket(); }} style={[styles.retry, { backgroundColor: theme.accent }]}><Text style={{ color: theme.text }}>Retry prices</Text></Pressable><Text style={{ color: theme.muted }}>Prices are unavailable. Pull to refresh after retrying.</Text></View> : null}
    {status.loading ? <View style={styles.loading}><ActivityIndicator color={theme.gain} /><Text style={{ color: theme.muted }}>Loading market prices…</Text></View> : <Holdings theme={theme} />}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 60 }, header: { paddingHorizontal: 22, paddingBottom: 20 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 }, title: { fontSize: 26, fontWeight: '700', marginTop: 10 },
  feed: { marginHorizontal: 20, borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between' },
  content: { padding: 20, paddingBottom: 48 }, summary: { borderWidth: 1, padding: 20, borderRadius: 20 },
  total: { fontSize: 34, fontWeight: '700', marginTop: 12, fontVariant: ['tabular-nums'] },
  metrics: { flexDirection: 'row', gap: 16, marginTop: 24 }, metric: { fontSize: 17, fontWeight: '600', marginVertical: 6 },
  day: { borderTopWidth: 1, marginTop: 20, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between' },
  note: { fontSize: 11, lineHeight: 17, marginTop: 14 }, section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 18 },
  heading: { fontSize: 21, fontWeight: '700' }, search: { padding: 14, borderWidth: 1, borderRadius: 12, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 19, borderBottomWidth: 1 },
  monogram: { height: 38, width: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 }, right: { alignItems: 'flex-end' }, symbol: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  caption: { fontSize: 11, marginTop: 5, fontVariant: ['tabular-nums'] }, empty: { padding: 24, gap: 12 },
  retry: { padding: 12, borderRadius: 8, alignSelf: 'flex-start' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});
