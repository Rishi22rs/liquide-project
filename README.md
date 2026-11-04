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

Implemented: all starting holdings; OHLC startup fetch and manual refresh; response validation and timeout; independent socket-shaped simulator; sequence rejection; partial updates; per-symbol row subscriptions; portfolio summary; symbol filtering; loading, empty-filter, error/retry, and paused states; system light/dark colors; Indian currency formatting.

Still to implement: sorting, watchlist/persistence/swipe removal, stock navigation/detail/chart, buy/sell sheet and transaction calculations, responsive safe-area handling, accessibility refinement, profiler/device verification, submission recording. No stretch goals yet.

## State and rendering

`src/state/market.ts` is a small external store using React's `useSyncExternalStore`. Quote objects are indexed by symbol. An accepted tick replaces only that symbol's object; unchanged quote objects keep their identity. Every row reads its own quote snapshot; the summary reads the whole quote map. The list itself does not subscribe to the quote map. Notifications still reach all subscriptions, but React sees unchanged snapshots for other rows and skips their rendering. This is an intentional small implementation for 25 symbols, to be measured in the React DevTools Profiler.

`src/feed/simulator.ts` exposes `connect`, `disconnect`, and `onTick`. It emits at 50ms intervals across available symbols, uses increasing per-symbol sequences, occasionally delivers an old sequence, and pauses for five seconds after each minute of activity. The store detects silence after two seconds. Prices are simulated on top of REST data; there is no API polling. A refresh stops the old feed and starts a new quote/sequence generation. Failed refreshes retain old quote data and expose a paused/error state.

## Money and missing data

API rupee prices are rounded once to integer paise. Starting average prices are integer paise. Multiplication by whole share quantities and summation then remain integer operations. Summary money values therefore equal the displayed row amounts. Trade average-cost precision/rounding will be defined and tested when orders are implemented.

Missing fields stay undefined and render as `--`. OLDCO is deliberately never seeded with a fabricated price. The summary labels market value and total P&L as priced holdings subtotals; excludes missing holdings from both those values and the P&L percentage denominator; reports the missing count; and separately shows invested cost for all holdings. With no priced holdings, value and P&L display `--`. Today's P&L uses `(last - previous close) * current quantity`; its percentage uses previous-close value for the same eligible positions. This is current-position day change, not realized intraday trade accounting. Holdings lacking previous close are excluded from this subtotal too.

## Validation and remaining work

Unit tests cover price conversion, stale/duplicate sequences, partial updates, unavailable prices, summary reconciliation, percentage denominators, and zero-denominator handling. Native device behavior and performance have **not** been verified yet. The current environment lacks configured iOS simulator tools; Android ADB startup is restricted in the sandbox.

Next: verify the portfolio on your target device, measure rendering, then implement sorting and the watchlist before stock detail/orders. With another day after the core, prioritize device profiling, lifecycle handling, accessibility, and more feed/transaction tests before optional features.

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
