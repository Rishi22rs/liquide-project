import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SearchField } from '../../components/SearchField';
import type { HoldingSortKey, SortDirection } from '../../domain/portfolio';
import { HoldingSortControls } from './HoldingSortControls';
import { useSortedHoldings } from './useSortedHoldings';
import { HOLDINGS } from '../../data/holdings';
import { loadMarket, useMarketStatus } from '../../state/market';
import type { Theme } from '../../theme/theme';
import { HoldingRow } from './HoldingRow';
import { PortfolioSummary } from './PortfolioSummary';
import { styles } from './styles';
import { TOOLBAR_HEIGHT } from './PortfolioHeader';

type Props = {
  theme: Theme;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  expandedHeader: ReactNode;
};

// Numeric sorting subscribes to order changes; price cells remain independently subscribed.
export function HoldingsList({ theme, onScroll, expandedHeader }: Props) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<HoldingSortKey>('name');
  const [direction, setDirection] = useState<SortDirection>('ascending');
  const status = useMarketStatus();
  const filteredHoldings = useMemo(
    () =>
      HOLDINGS.filter((holding) => holding.symbol.includes(query.trim().toUpperCase())),
    [query],
  );
  const data = useSortedHoldings(filteredHoldings, sortKey, direction);

  function selectSort(key: HoldingSortKey) {
    setSortKey(key);
    setDirection(key === 'name' ? 'ascending' : 'descending');
  }

  return (
    <Animated.FlatList
      data={status.loading ? [] : data}
      keyExtractor={(holding) => holding.symbol}
      renderItem={({ item }) => (
        <View style={styles.rowContainer}>
          <HoldingRow holding={item} theme={theme} />
        </View>
      )}
      contentContainerStyle={{ paddingBottom: 32 }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      scrollIndicatorInsets={{ top: TOOLBAR_HEIGHT }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          progressViewOffset={TOOLBAR_HEIGHT}
          refreshing={status.loading}
          onRefresh={() => {
            void loadMarket();
          }}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
      ListHeaderComponent={
        <>
          {expandedHeader}
          {!status.loading && (
            <View style={styles.listHeaderContent}>
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
              <HoldingSortControls
                sortKey={sortKey}
                direction={direction}
                onSelect={selectSort}
                onToggleDirection={() =>
                  setDirection((current) =>
                    current === 'ascending' ? 'descending' : 'ascending',
                  )
                }
                theme={theme}
              />
              <View style={styles.section}>
                <Text style={[styles.caption, { color: theme.muted }]}>
                  SYMBOL / POSITION
                </Text>
                <Text style={[styles.caption, { color: theme.muted }]}>VALUE / P&L</Text>
              </View>
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        status.loading ? (
          <View style={styles.loadingPlaceholder}>
            <ActivityIndicator color={theme.primary} />
            <Text style={{ color: theme.muted }}>Loading market prices…</Text>
          </View>
        ) : (
          <Text style={[styles.empty, { color: theme.muted }]}>
            No holdings match “{query}”.
          </Text>
        )
      }
    />
  );
}
