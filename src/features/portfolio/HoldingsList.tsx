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

// This child does not subscribe to quotes: stable list data prevents parent updates on ticks.
export function HoldingsList({ theme, onScroll, expandedHeader }: Props) {
  const [query, setQuery] = useState('');
  const status = useMarketStatus();
  const data = useMemo(
    () =>
      HOLDINGS.filter((holding) => holding.symbol.includes(query.trim().toUpperCase())),
    [query],
  );
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
