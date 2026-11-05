import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SearchField } from '../../components/SearchField';
import { SYMBOLS } from '../../data/holdings';
import { useWatchlist, watchlistStore } from '../../state/watchlist';
import type { Theme } from '../../theme/theme';
import { styles } from './styles';

type Props = { onClose: () => void; theme: Theme };

// Mounted only while open: reopening starts with a fresh search field.
export function StockPicker({ onClose, theme }: Props) {
  const [query, setQuery] = useState('');
  const watchlist = useWatchlist();
  const stocks = useMemo(
    () => SYMBOLS.filter((symbol) => symbol.includes(query.trim().toUpperCase())),
    [query],
  );

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg }]}>
        <View style={styles.pickerHeader}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>Add stocks</Text>
              <Text style={[styles.subtitle, { color: theme.muted }]}>
                Choose from 25 NSE stocks
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close stock picker"
              onPress={onClose}
              style={[
                styles.close,
                { borderColor: theme.line, backgroundColor: theme.card },
              ]}
            >
              <View style={styles.closeIcon}>
                <View
                  style={[
                    styles.closeStroke,
                    { backgroundColor: theme.text, transform: [{ rotate: '45deg' }] },
                  ]}
                />
                <View
                  style={[
                    styles.closeStroke,
                    { backgroundColor: theme.text, transform: [{ rotate: '-45deg' }] },
                  ]}
                />
              </View>
            </Pressable>
          </View>
          {watchlist.error && (
            <View style={[styles.error, { borderColor: theme.line }]}>
              <Text style={[styles.caption, { color: theme.text }]}>
                {watchlist.error}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={watchlistStore.retry}
                style={styles.retry}
              >
                <Text style={[styles.retryLabel, { color: theme.accentText }]}>
                  Retry saving
                </Text>
              </Pressable>
            </View>
          )}
          <SearchField
            value={query}
            onChangeText={setQuery}
            theme={theme}
            accessibilityLabel="Search available stocks"
          />
        </View>
        <FlatList
          data={stocks}
          keyExtractor={(symbol) => symbol}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          renderItem={({ item: symbol }) => {
            const added = watchlist.symbols.includes(symbol);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add ${symbol} to watchlist`}
                accessibilityState={{ disabled: added }}
                disabled={added}
                onPress={() => watchlistStore.add(symbol)}
                style={({ pressed }) => [
                  styles.pickerRow,
                  { borderColor: theme.line, opacity: pressed ? 0.65 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.monogram,
                    { backgroundColor: theme.elevated, borderColor: theme.line },
                  ]}
                >
                  <Text style={[styles.monogramText, { color: theme.accentText }]}>
                    {symbol.slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.symbol, { color: theme.text }]}>{symbol}</Text>
                  <Text style={[styles.caption, { color: theme.muted }]}>
                    NSE · Equity
                  </Text>
                </View>
                <View
                  style={[
                    styles.pickerAction,
                    {
                      borderColor: theme.line,
                      backgroundColor: added ? theme.card : theme.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.label,
                      { color: added ? theme.muted : theme.accentText },
                    ]}
                  >
                    {added ? 'Added' : '+ Add'}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          ListHeaderComponent={
            <Text style={[styles.caption, { color: theme.muted }]}>
              {watchlist.symbols.length} stocks selected · Tap to add
            </Text>
          }
          ListEmptyComponent={
            <Text style={[styles.emptyBody, { color: theme.muted, marginTop: 28 }]}>
              No stocks match “{query}”.
            </Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
