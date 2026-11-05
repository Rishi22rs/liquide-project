import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { SearchField } from '../../components/SearchField';
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
          tintColor={theme.gold}
          colors={[theme.gold]}
        />
      }
      ListHeaderComponent={
        <>
          <PortfolioSummary theme={theme} />
          <View style={styles.section}>
            <Text style={[styles.heading, { color: theme.text }]}>Your holdings</Text>
            <View style={[styles.countBadge, { backgroundColor: theme.elevated }]}>
              <Text style={[styles.countText, { color: theme.text }]}>
                {HOLDINGS.length}
              </Text>
            </View>
          </View>
          <SearchField value={query} onChangeText={setQuery} theme={theme} />
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
