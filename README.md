# Liquide Portfolio

A React Native live portfolio built with Expo and strict TypeScript for the Liquide take-home assignment. It combines an initial REST quote snapshot with a local tick simulator. Trades are paper trades; no broker orders are sent.

## Install and run

Requirements: Node.js 24+, npm, and an Android device/emulator or iOS device/simulator. This project uses Expo SDK 58; use a compatible Expo Go version or a development build. An iOS simulator requires macOS and Xcode; an Android emulator requires Android Studio and its SDK.

```sh
npm ci
npm start
```

Scan the QR code with compatible Expo Go, or launch an installed emulator/simulator:

```sh
npm run android
npm run ios
```

These commands start the Expo development server; they do not create a standalone release APK. Internet access is needed for the initial OHLC request, manual refresh and recovery snapshots. No API key or account is required. `npm run web` is also available, although browser access to the quote endpoint depends on its CORS policy.

## Implemented features

| Area                  | Behavior                                                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portfolio             | Current value, invested amount, total and today's P&L; live holding rows; symbol search; name/value/P&L sorting in either direction; pull-to-refresh. |
| Watchlist             | Add from the 25 allowed symbols, live price/day change, swipe removal and persistence across restarts.                                                |
| Stock detail          | Live OHLC, previous close, volume, held position and a chart of ticks received since opening the screen.                                              |
| Chart interaction     | Pinch zoom, horizontal history browsing and a crosshair with an exact recorded price/time while holding a finger on the chart.                        |
| Local trading         | Whole-share buys/sells, latest-price confirmation, weighted average buys, partial/full sales and oversell protection.                                 |
| UI states             | Loading, empty, error/retry, unavailable-price and paused-feed states; Indian currency formatting; dark and light palettes.                           |
| Navigation and layout | Portfolio, Watchlist and Orders tabs; shared stock detail; fading header and sticky portfolio search/sort controls.                                   |

All five optional stretch goals are implemented:

| Bonus                        | Implementation                                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Price-cell flash             | Green/red opacity flashes use the native animation driver on Android/iOS; Reduce Motion disables them.                                                            |
| Reconnect and catch-up       | Single recovery flow with exponential backoff capped at 30 seconds, a silence watchdog and a REST catch-up before replacing the stream.                           |
| Limit orders                 | Buy at/below the limit, sell at/above it; fills use the accepted tick price. Pending sells reserve shares; orders can be cancelled.                               |
| Persisted order history      | Orders tab stores market fills and limit-order status changes locally, including captured fill prices and values.                                                 |
| Developer simulator controls | Development-only DEV panel/native developer-menu entry offers 5/20/50/100 ticks per second and a forced disconnect. Release builds hide and guard these controls. |

All five bonuses are implemented.

## State, rendering and architecture

The app separates pure business rules (`src/domain/`), quote transport (`src/feed/`), REST/seed data (`src/data/`), external stores (`src/state/`) and screens (`src/features/`). `App.tsx` owns one shared feed and the limit-order matcher, so navigation and theme changes do not restart the stream.

The quote store uses React's `useSyncExternalStore`. Quotes are indexed by symbol, and an accepted tick replaces only that symbol's quote object. Memoized rows subscribe to their own symbol; unchanged snapshots keep their identity, allowing React to skip unrelated row renders. Store notifications still reach subscriptions: this is snapshot isolation, not a claim that only one listener is called.

The summary subscribes to all quotes because every relevant price can change its totals. The holdings list subscribes to derived sort order rather than raw quotes. Name sorting needs no quote subscription; numeric sorting keeps the previous array while the order remains unchanged. Holding objects also retain identity when another position is traded. This small store is sufficient for the assignment's symbol set and keeps the update path explicit without another state library.

The simulator sits behind a `connect`/`disconnect`/`onTick` transport contract. It emits approximately 20 aggregate ticks per second by default, partial updates, occasional late sequences and a five-second outage roughly every minute. Duplicate/late sequences are rejected per symbol. Invalid or absent fields do not erase valid quote fields. Replacing it with a real WebSocket adapter would also require adapting connection readiness to the socket's asynchronous open event.

REST is used at startup, manual refresh and recovery, with no continuous polling. Recovery cancels retired callbacks and starts a new sequence generation. Existing quotes remain visible with a paused indicator while recovery is in progress. Startup request failures offer explicit retry.

## Money and a holding with no price

Prices enter the domain as integer paise. Position values, cost basis and summary money totals use that representation. Buys maintain an explicit cost basis and a weighted average; the average is rounded only for display. Partial sells allocate the remaining cost basis with integer arithmetic and half-paise ties rounded up. Consequently, the displayed average multiplied by quantity can differ slightly from the exact invested amount; totals use the stored cost basis.

`OLDCO` deliberately has no quote. It displays `--`, never zero or an invented price.

| Summary field   | Missing-price policy                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| Invested amount | Includes the cost basis of every holding, including OLDCO.                                               |
| Current value   | Includes priced holdings only and is labelled as a subtotal.                                             |
| Total P&L       | Includes priced holdings only. Its percentage denominator is the cost basis of those same holdings.      |
| Today's P&L     | Includes holdings with both a last price and previous close. Percentage uses their previous-close value. |

The UI discloses excluded holdings. With holdings but no usable prices, affected totals display `--`; a genuinely empty portfolio can show zero. Search/filtering does not change summary totals. Row and summary money calculations share the same pure functions.

Today's P&L is `(last price - previous close) × current quantity`. It describes current positions, not realized intraday trading profit.

## Trading and persistence decisions

Market confirmation re-reads the latest quote and holding, validates the quantity, and updates holdings synchronously. Duplicate confirmation IDs cannot execute twice. A paused feed permits a disclosed last-known-price market fill; a missing or non-positive price blocks trading. Limit orders wait for accepted price ticks, including when already eligible at placement. Matching is FIFO, fills once at the actual tick price and ignores REST snapshots, stale ticks and volume-only updates.

Watchlist, order history and the manual theme preference persist through AsyncStorage. Writes are serialized; storage failures retain in-memory changes and expose retry. History captures transaction values rather than recalculating them from later prices.

Holdings and active orders reset to the supplied seed on restart. Previously pending limit orders become expired history and are not replayed against reset positions. History saves are asynchronous, so a force-quit before a save completes can lose the latest event. There is no cash balance, fee model, realized-P&L ledger or account synchronization.

## Checks and tested platforms

```sh
npm run typecheck
npm test
npm run format:check
```

The current suite has 92 tests covering calculations, row/summary reconciliation, sequence handling, sorting, chart selection/viewport math, trades, limit reservations, reconnect races, persistence and theme preferences.

| Platform/check           | Verification performed                                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile-sized web preview | Portfolio, search/sort, watchlist, detail/chart, trading, limit orders, history, recovery and theme flows exercised. Populated-price checks used a temporary local proxy to the public OHLC endpoint; application API code was unchanged. |
| Android release          | Tested on a physical Android device. Signed ARM64 APK packaging, signature, manifest and embedded bundle also verified.                                                                                                                   |
| iOS                      | JavaScript bundle export checked.                                                                                                                                                                                                         |

## Android APK

The latest local artifact is `builds/LiquidePortfolio-1.0.0-v4-arm64-release.apk`: package `com.rishi.liquideportfolio`, version 1.0.0/code 4, ARM64, Android 7.0/API 24 or newer. It embeds the JavaScript bundle and does not require Metro or Expo Go.

APKs, generated native projects and private signing files are ignored by Git, so this artifact is **not included in a repository clone**. It must be shared separately for installation. Local Android builds used JDK 17 and Gradle `:app:assembleRelease` with the ARM64 architecture. A fresh checkout requires Expo native-project generation and release signing configuration; private signing credentials are intentionally not included.

## Deviations, skipped work and another day

- **Theme behavior:** both palettes are available through the saved header switch, defaulting to dark. This follows the requested design changes; it differs from the brief's automatic system-theme requirement.
- **Chart retention:** rendered SVG points are sampled, but raw session history remains in memory while the detail screen is open. Long-running sessions would benefit from bounded retention.

With another day, I would add bounded chart retention, broaden accessibility support and strengthen app lifecycle handling.

## Time spent

Approximately 5–6 hours of active work (estimated, not formally tracked).

## Submission checklist

- Keep the incremental Git history; do not squash the assignment into one commit.
- Share the repository link within the brief's three-calendar-day window.
- Include the required 1–2 minute device/emulator screen recording.
- Share the APK separately if the reviewer needs an installable Android build.
