# Liquide Portfolio

React Native take-home, built incrementally with Expo and strict TypeScript.

## Run

Use Node 24 or later (the tests use Node's TypeScript stripping).

```sh
npm ci
npm start
```

Open on a compatible physical device with Expo Go, or use `npm run android` / `npm run ios` with an installed emulator/simulator. The generated dependencies currently use Expo SDK 58; confirm your Expo Go version supports it, or use a development build.

```sh
npm run typecheck
npm test
```

## Step 1: portfolio and feed foundation

Implemented: all starting holdings; OHLC startup fetch and manual refresh; response validation and timeout; independent socket-shaped simulator; sequence rejection; partial updates; per-symbol row subscriptions; portfolio summary; symbol filtering; loading, empty-filter, error/retry, and paused states; reference-matched dark colors (light palette retained); Indian currency formatting.

Still to implement: watchlist/persistence/swipe removal, stock navigation/detail/chart, buy/sell sheet and transaction calculations, accessibility refinement, profiler/device verification, submission recording. No stretch goals yet.

## State and rendering

`src/state/market.ts` is a small external store using React's `useSyncExternalStore`. Quote objects are indexed by symbol. An accepted tick replaces only that symbol's object; unchanged quote objects keep their identity. Every row reads its own quote snapshot; the summary reads the whole quote map. The list does not subscribe to raw quote snapshots. Name sorting needs no feed subscription; value/P&L sorting subscribes to the derived holding order and preserves the array identity while that order is unchanged. Notifications still reach all subscriptions, but React sees unchanged snapshots for other rows and skips their rendering. This is an intentional small implementation for 25 symbols, to be measured in the React DevTools Profiler.

`src/feed/simulator.ts` exposes `connect`, `disconnect`, and `onTick`. It emits at 50ms intervals across available symbols, uses increasing per-symbol sequences, occasionally delivers an old sequence, and pauses for five seconds after each minute of activity. The store detects silence after two seconds. Prices are simulated on top of REST data; there is no API polling. A refresh stops the old feed and starts a new quote/sequence generation. Failed refreshes retain old quote data and expose a paused/error state.

## Money and missing data

API rupee prices are rounded once to integer paise. Starting average prices are integer paise. Multiplication by whole share quantities and summation then remain integer operations. Summary money values therefore equal the displayed row amounts. Trade average-cost precision/rounding will be defined and tested when orders are implemented.

Missing fields stay undefined and render as `--`. OLDCO is deliberately never seeded with a fabricated price. The summary labels market value and total P&L as priced holdings subtotals; excludes missing holdings from both those values and the P&L percentage denominator; reports the missing count; and separately shows invested cost for all holdings. With no priced holdings, value and P&L display `--`. Today's P&L uses `(last - previous close) * current quantity`; its percentage uses previous-close value for the same eligible positions. This is current-position day change, not realized intraday trade accounting. Holdings lacking previous close are excluded from this subtotal too.

## Validation and remaining work

Unit tests cover price conversion, stale/duplicate sequences, partial updates, unavailable prices, summary reconciliation, percentage denominators, and zero-denominator handling. Native device behavior and performance have **not** been verified yet. The current environment lacks configured iOS simulator tools; Android ADB startup is restricted in the sandbox.

Next: verify the portfolio on your target device, measure rendering, then implement the watchlist before stock detail/orders. With another day after the core, prioritize device profiling, lifecycle handling, accessibility, and more feed/transaction tests before optional features.

Time spent: not yet recorded; update with actual working time before submission.

## Code map and conventions

- `App.tsx`: starts/stops the shared price feed and mounts the screen.
- `src/features/portfolio/PortfolioScreen.tsx`: page layout and connection/error states.
- `src/features/portfolio/HoldingsList.tsx`: filtering and list configuration.
- `src/features/portfolio/HoldingRow.tsx`: one position and its symbol subscription.
- `src/features/portfolio/PortfolioSummary.tsx`: portfolio totals and missing-price explanation.
- `src/features/portfolio/styles.ts`: portfolio layout styles.
- `src/theme/theme.ts`: shared system-based color palettes.
- `src/state/market.ts`: quote snapshots, subscriptions, request lifecycle and feed health.
- `src/domain/portfolio.ts`: pure calculation and tick-merge functions.
- `src/data/`: seed holdings and validated REST data.
- `src/feed/`: replaceable feed contract and simulator implementation.

Keep components focused on one responsibility. Give lifecycle/timing values explicit names. Comments explain business rules and non-obvious performance or lifecycle decisions. Keep calculations outside components so they can be tested without a device. Use `npm run format` to format code and `npm run format:check` to check it. Add future screens alongside portfolio under `src/features/`, sharing domain, state, and theme modules.


## Visual reference

The UI matches the user-provided Liquide screenshots: black backgrounds, charcoal cards, white text, fine outlines, rounded corners, and yellow-to-orange actions. Per the latest user instruction, dark mode is the default regardless of device appearance. The light palette is retained in the theme module; restoring automatic system selection remains necessary if submitting against the original brief unchanged. Shared colors live in `src/theme/theme.ts`; shared search and theme-colored gradient button components live in `src/components/`. The retained light palette uses white/neutral surfaces. System safe areas are handled by `SafeAreaProvider` and `SafeAreaView`.

The portfolio layout was visually inspected in a 390 × 844 web preview in dark mode. The API request failed in that browser preview, so error/retry and unavailable-price states were inspected; populated live-price layout and native performance still need device verification. Reference-only features (broker linking, advice, subscriptions, research scores) are outside this assignment's implementation.


## Scroll-linked header

`PortfolioHeader.tsx` implements the pinned toolbar from the supplied video. The expanded title/status surface scrolls with the list and fades over the first 140 points. The toolbar backdrop simultaneously fades to black, with a short gradient at its lower edge. Scrolling back to the top reverses the transition directly. Feed status remains visible in the pinned toolbar even after the expanded header is gone.

One stable `Animated.Value` connects `Animated.FlatList` scroll events to opacity interpolations. Android/iOS use the native driver; web uses the JS driver. No React state updates are performed per scroll frame. Keep animation tuning in `TOOLBAR_HEIGHT` / `HEADER_FADE_DISTANCE`; if changing toolbar height, update expanded-header spacing too. Forward/reverse transitions were visually checked in a 390 × 844 web preview. Native smoothness still needs device verification.


## Step 2: portfolio sorting

Holdings can be sorted by symbol name, current value, or absolute P&L in rupees. Name defaults to ascending; numeric sorts default to descending. The arrow reverses the direction. Numeric sorts keep unpriced holdings last in both directions; equal amounts use symbol A-Z as a deterministic tie-breaker. Filtering and sorting work together without changing summary totals.

`sortHoldings` is a pure function in `src/domain/portfolio.ts`. `useSortedHoldings.ts` subscribes to derived order rather than every quote object: it returns the previous array if the holding identities remain in the same order. On a price crossover the list order updates; memoized rows still receive the same holding objects. This deliberately permits live row movement in value/P&L modes. Native profiling is still pending.

Five additional tests cover direction changes, quantities, zero versus missing prices, positive/negative P&L, stable ties, non-mutation and reordering after a price update. UI checks in the web preview covered all three controls, direction reversal, and searching/clearing while sorting. The browser API request failed, so populated numeric ordering was verified in domain tests rather than against live browser prices.
