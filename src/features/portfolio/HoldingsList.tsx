import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { useHoldings } from '../../state/holdings';
import { loadMarket, useMarketStatus } from '../../state/market';
import type { Theme } from '../../theme/theme';
import { HoldingRow } from './HoldingRow';
import { PortfolioSummary } from './PortfolioSummary';
import { styles } from './styles';
import { TOOLBAR_HEIGHT } from './PortfolioHeader';

// Search and sort occupy one stable, sticky virtualized-list cell.
type ControlsRow = Readonly<{ kind: 'controls' }>;
const CONTROLS_ROW: ControlsRow = { kind: 'controls' };
type ListRow = Holding | ControlsRow;

// Browser scroll anchoring otherwise shifts the focused section when rows disappear.
const webListStyle = { flex: 1, overflowAnchor: 'none' as const };

type Props = {
  theme: Theme;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  expandedHeader: ReactNode;
};

// Numeric sorting subscribes to order changes; price cells remain independently subscribed.
export function HoldingsList({ theme, onScroll, expandedHeader }: Props) {
  const listRef = useRef<FlatList<ListRow>>(null);
  const searchFocused = useRef(false);
  const searchTarget = useRef(0);
  const headerHeight = useRef(0);
  const { height: windowHeight } = useWindowDimensions();
  const [searchScrollOffset, setSearchScrollOffset] = useState(0);

  function focusHoldingsSearch() {
    searchFocused.current = true;
    // The controls are a real sticky list item, directly after the measured header.
    const offset = headerHeight.current;
    searchTarget.current = offset;
    setSearchScrollOffset(offset);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset, animated: true });
    });
  }

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<HoldingSortKey>('name');
  const [direction, setDirection] = useState<SortDirection>('ascending');
  const status = useMarketStatus();
  const holdings = useHoldings();
  const filteredHoldings = useMemo(
    () =>
      holdings.filter((holding) => holding.symbol.includes(query.trim().toUpperCase())),
    [holdings, query],
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
    <View style={{ flex: 1, paddingTop: TOOLBAR_HEIGHT }}>
      <Animated.FlatList
        ref={listRef}
        style={Platform.OS === 'web' ? webListStyle : undefined}
        data={status.loading ? [] : [CONTROLS_ROW, ...data]}
        // Index 0 is ListHeaderComponent; index 1 is the search/sort item.
        stickyHeaderIndices={status.loading ? [] : [1]}
        removeClippedSubviews={false}
        keyExtractor={(item) => ('kind' in item ? 'holding-controls' : item.symbol)}
        renderItem={({ item }) =>
          'kind' in item ? (
            <View
              style={[
                styles.stickyControls,
                { backgroundColor: theme.bg, borderBottomColor: theme.line },
              ]}
            >
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
              <View style={styles.columnHeadings}>
                <Text style={[styles.caption, { color: theme.muted }]}>
                  SYMBOL / POSITION
                </Text>
                <Text style={[styles.caption, { color: theme.muted }]}>VALUE / P&L</Text>
              </View>
            </View>
          ) : (
            <View style={styles.rowContainer}>
              <HoldingRow holding={item} theme={theme} />
            </View>
          )
        }
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
        scrollIndicatorInsets={{ top: 0 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            progressViewOffset={0}
            refreshing={status.loading}
            onRefresh={() => {
              void loadMarket();
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListHeaderComponent={
          <View
            onLayout={(event) => {
              headerHeight.current = event.nativeEvent.layout.height;
            }}
          >
            {expandedHeader}
            {!status.loading && (
              <View style={styles.listHeaderContent}>
                <PortfolioSummary theme={theme} />
                <View style={styles.section}>
                  <Text style={[styles.heading, { color: theme.text }]}>
                    Your holdings
                  </Text>
                  <View style={[styles.countBadge, { backgroundColor: theme.elevated }]}>
                    <Text style={[styles.countText, { color: theme.text }]}>
                      {holdings.length}
                    </Text>
                  </View>
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
          ) : undefined
        }
        ListFooterComponent={
          !status.loading && data.length === 0 ? (
            <Text style={[styles.empty, { color: theme.muted }]}>
              {holdings.length === 0
                ? 'No holdings yet. Add a stock to your watchlist and open its detail to buy shares.'
                : `No holdings match “${query}”.`}
            </Text>
          ) : undefined
        }
      />
    </View>
  );
}
