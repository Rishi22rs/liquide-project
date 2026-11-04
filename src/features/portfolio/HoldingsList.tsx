import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import { HOLDINGS } from '../../data/holdings';
import { loadMarket, useMarketStatus } from '../../state/market';
import type { Theme } from '../../theme/theme';
import { HoldingRow } from './HoldingRow';
import { PortfolioSummary } from './PortfolioSummary';
import { styles } from './styles';

// This child does not subscribe to quotes: stable list data prevents parent updates on ticks.
export function HoldingsList({ theme }: { theme: Theme }) {
  const [query, setQuery] = useState('');
  const status = useMarketStatus();
  const data = useMemo(
    () =>
      HOLDINGS.filter((holding) => holding.symbol.includes(query.trim().toUpperCase())),
    [query],
  );
  return (
    <FlatList
      data={data}
      keyExtractor={(holding) => holding.symbol}
      renderItem={({ item }) => <HoldingRow holding={item} theme={theme} />}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={status.loading}
          onRefresh={() => {
            void loadMarket();
          }}
          tintColor={theme.gain}
        />
      }
      ListHeaderComponent={
        <>
          <PortfolioSummary theme={theme} />
          <View style={styles.section}>
            <Text style={[styles.heading, { color: theme.text }]}>Your holdings</Text>
            <Text style={{ color: theme.muted }}>{HOLDINGS.length} positions</Text>
          </View>
          <TextInput
            accessibilityLabel="Filter holdings by symbol"
            placeholder="Search a symbol"
            placeholderTextColor={theme.muted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="characters"
            style={[
              styles.search,
              { backgroundColor: theme.card, color: theme.text, borderColor: theme.line },
            ]}
          />
          <View style={styles.section}>
            <Text style={[styles.caption, { color: theme.muted }]}>
              SYMBOL / POSITION
            </Text>
            <Text style={[styles.caption, { color: theme.muted }]}>VALUE / P&L</Text>
          </View>
        </>
      }
      ListEmptyComponent={
        <Text style={[styles.empty, { color: theme.muted }]}>
          No holdings match “{query}”.
        </Text>
      }
    />
  );
}
