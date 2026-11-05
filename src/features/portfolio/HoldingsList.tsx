import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  RefreshControl,
  Text,
  View,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SearchField } from '../../components/SearchField';
import type { Holding, HoldingSortKey, SortDirection } from '../../domain/portfolio';
import { HoldingSortControls } from './HoldingSortControls';
import { useSortedHoldings } from './useSortedHoldings';
import { HOLDINGS } from '../../data/holdings';
import { loadMarket, useMarketStatus } from '../../state/market';
import type { Theme } from '../../theme/theme';
import { HoldingRow } from './HoldingRow';
import { PortfolioSummary } from './PortfolioSummary';
import { styles } from './styles';
import { TOOLBAR_HEIGHT } from './PortfolioHeader';

// Browser scroll anchoring otherwise shifts the focused section when rows disappear.
const webListStyle = { flex: 1, overflowAnchor: 'none' as const };

type Props = {
  theme: Theme;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  expandedHeader: ReactNode;
};

// Numeric sorting subscribes to order changes; price cells remain independently subscribed.
export function HoldingsList({ theme, onScroll, expandedHeader }: Props) {
  const listRef = useRef<FlatList<Holding>>(null);
  const searchFocused = useRef(false);
  const searchTarget = useRef(0);
  const headerRef = useRef<ComponentRef<typeof View>>(null);
  const holdingsSectionRef = useRef<ComponentRef<typeof View>>(null);
  const { height: windowHeight } = useWindowDimensions();
  const [searchScrollOffset, setSearchScrollOffset] = useState(0);

  function focusHoldingsSearch() {
    searchFocused.current = true;
    const header = headerRef.current;
    if (!header) return;

    // Measure at focus time so errors, refreshed totals and larger fonts are included.
    holdingsSectionRef.current?.measureLayout(header, (_x, sectionY) => {
      const offset = Math.max(0, sectionY - TOOLBAR_HEIGHT - 24);
      searchTarget.current = offset;
      setSearchScrollOffset(offset);
      // Let the minimum content height apply before moving a short/empty result list.
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset, animated: true });
      });
    });
  }

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

  useEffect(() => {
    if (!searchFocused.current) return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: searchTarget.current, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [query]);

  function selectSort(key: HoldingSortKey) {
    setSortKey(key);
    setDirection(key === 'name' ? 'ascending' : 'descending');
  }

  return (
    <Animated.FlatList
      ref={listRef}
      style={Platform.OS === 'web' ? webListStyle : undefined}
      data={status.loading ? [] : data}
      keyExtractor={(holding) => holding.symbol}
      renderItem={({ item }) => (
        <View style={styles.rowContainer}>
          <HoldingRow holding={item} theme={theme} />
        </View>
      )}
      // Keep the target reachable even when filtering leaves one row or no results.
      contentContainerStyle={{
        paddingBottom: 32,
        minHeight: searchScrollOffset + windowHeight,
      }}
      automaticallyAdjustKeyboardInsets
      onContentSizeChange={() => {
        // Filtering can adjust a virtualized list's offset. Keep the focused
        // search section anchored after the new result layout has settled.
        if (searchFocused.current)
          requestAnimationFrame(() => {
            listRef.current?.scrollToOffset({
              offset: searchTarget.current,
              animated: false,
            });
          });
      }}
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
        <View ref={headerRef} collapsable={false}>
          {expandedHeader}
          {!status.loading && (
            <View style={styles.listHeaderContent}>
              <PortfolioSummary theme={theme} />
              <View style={styles.section} ref={holdingsSectionRef} collapsable={false}>
                <Text style={[styles.heading, { color: theme.text }]}>Your holdings</Text>
                <View style={[styles.countBadge, { backgroundColor: theme.elevated }]}>
                  <Text style={[styles.countText, { color: theme.text }]}>
                    {HOLDINGS.length}
                  </Text>
                </View>
              </View>
              <SearchField
                value={query}
                onChangeText={setQuery}
                onFocus={focusHoldingsSearch}
                onBlur={() => {
                  searchFocused.current = false;
                }}
                theme={theme}
              />
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
        </View>
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
