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

Remaining before submission: native device verification, performance profiling, accessibility refinement, README finalization and the screen recording. The first stretch goal, price-cell flash, is implemented; native verification is pending.

## State and rendering

`src/state/market.ts` is a small external store using React's `useSyncExternalStore`. Quote objects are indexed by symbol. An accepted tick replaces only that symbol's object; unchanged quote objects keep their identity. Every row reads its own quote snapshot; the summary reads the whole quote map. The list does not subscribe to raw quote snapshots. Name sorting needs no feed subscription; value/P&L sorting subscribes to the derived holding order and preserves the array identity while that order is unchanged. Notifications still reach all subscriptions, but React sees unchanged snapshots for other rows and skips their rendering. This is an intentional small implementation for 25 symbols, to be measured in the React DevTools Profiler.

`src/feed/simulator.ts` exposes `connect`, `disconnect`, and `onTick`. It emits at 50ms intervals across available symbols, uses increasing per-symbol sequences, occasionally delivers an old sequence, and pauses for five seconds after each minute of activity. The store detects silence after two seconds. Prices are simulated on top of REST data; there is no API polling. A refresh stops the old feed and starts a new quote/sequence generation. Failed refreshes retain old quote data and expose a paused/error state.

## Money and missing data

API rupee prices are rounded once to integer paise. Starting average prices are integer paise. Multiplication by whole share quantities and summation then remain integer operations. Summary money values therefore equal the displayed row amounts. Trades retain an explicit integer-paise cost basis; weighted averages retain sub-paise precision until display. Partial-sale allocation uses exact integer division with half-paise ties rounded up.

Missing fields stay undefined and render as `--`. OLDCO is deliberately never seeded with a fabricated price. The summary labels market value and total P&L as priced holdings subtotals; excludes missing holdings from both those values and the P&L percentage denominator; reports the missing count; and separately shows invested cost for all holdings. With no priced holdings, value and P&L display `--`. Today's P&L uses `(last - previous close) * current quantity`; its percentage uses previous-close value for the same eligible positions. This is current-position day change, not realized intraday trade accounting. Holdings lacking previous close are excluded from this subtotal too.

## Validation and remaining work

Unit tests cover price conversion, stale/duplicate sequences, partial updates, unavailable prices, summary reconciliation, percentage denominators, and zero-denominator handling. Native device behavior and performance have **not** been verified yet. The current environment lacks configured iOS simulator tools; Android ADB startup is restricted in the sandbox.

Next: test all flows on the target device, profile rendering and prepare the submission recording. With another day after the core, prioritize lifecycle handling, accessibility and additional edge-case verification before optional features.

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


## Step 3: persistent watchlist

React Navigation provides two bottom tabs, retaining portfolio search/sort state when switching screens. The feed is owned by `App.tsx` and is not reconnected when navigating. Watchlist rows reuse per-symbol quote subscriptions and show last price plus day change in rupees/percent, with `--` for unavailable values. The full-screen picker searches the 25 allowed symbols and prevents duplicate additions.

`src/domain/watchlist.ts` contains an injected-storage store. `src/state/watchlist.ts` connects it to AsyncStorage and React. Startup hydrates selections before edits are allowed. Writes are serialized so fast edits cannot save an older list after a newer one. A failed read blocks edits and offers retry; a failed write retains the local selection and offers retry. Malformed saved data is reported rather than silently overwritten. Unknown symbols and duplicates are discarded during validation. Watchlist selections are local to this installation; this is not account sync.

Swipe left to reveal Remove, then tap it. `SwipeToRemove.tsx` uses PanResponder with a horizontal threshold so vertical scrolling remains with the list. Settling springs use the native driver on Android/iOS; gesture movement is JS-driven and requires native performance verification. The compact action uses a drawn trash icon on a muted red surface. Long-pressing a row reveals the same action; screen readers also have a named Remove action. Row-level repeated Remove text has been replaced by these alternatives. Dividers remain stationary during a swipe, and the short reveal distance preserves the stock name. This approach avoids additional gesture/animation dependencies for a 25-symbol list.

Seven new tests cover saved-data validation, hydration protection, unique allowed-symbol additions, removal and restart persistence, serialized rapid edits, storage read/write recovery and day-change calculations. The full suite now has 18 tests. Mobile web checks covered tab navigation, picker filtering, additions, duplicate prevention, swipe reveal/removal, accessible removal, empty state, and persistence after reload. The shared API request fails in this browser preview, so populated live-price behavior and native gesture performance remain unverified. The iOS JavaScript bundle builds; that is not a native device test.

Next: native performance verification and submission preparation.


## Step 4: stock detail and session chart

Tapping a portfolio or watchlist row opens the shared `StockDetail` route in a typed native stack above the tabs. Back returns to the original tab/search/sort state. The detail toolbar keeps feed status visible while scrolling. It shows last price, day change, open, previous close, high, low and volume, plus the held position calculated from the same seed holdings and domain functions as the portfolio. Unheld stocks show an explicit empty position. Allowed symbols can be added/removed from the saved watchlist directly in detail; OLDCO remains unavailable and cannot be added to the allowed-symbol picker.

`src/state/market.ts` publishes a separate accepted-price event after the quote sequence check. Only a supplied, valid price produces this event: volume-only, invalid-price and rejected stale ticks cannot create fake chart points. `useTickHistory.ts` attaches a per-screen history and cleans up its subscription on unmount. History is not persisted or seeded from the REST snapshot. Opening a stock starts an empty session, a single received tick is a dot, and two or more ticks produce a line. A refresh does not erase the screen's session; subsequent accepted ticks continue it.

`src/domain/tickHistory.ts` owns pure history and geometry functions. The SVG chart plots actual receipt times and uses integer-paise prices. Its color compares the latest received price with the session's first price; the price header's day change separately compares last price with previous close. Long sessions retain their raw ticks in screen memory, but SVG rendering is limited to at most 240 actual points using first/last and bucket min/max sampling. Range labels use the entire session. History memory grows with time while the screen remains open; a production long-running screen could compact old buckets. The chart uses react-native-svg for lightweight cross-platform drawing rather than a larger chart library.

Seven chart tests bring the suite to 25: empty/independent sessions, symbol/price validation, rapid ticks and listener cleanup, flat/single values, timestamp coordinates, equal-time ticks, and sampled endpoints/extrema. Browser UI verification covered both row entry points, Back preserving search state, watchlist toggling, OLDCO, unheld positions and swipe/tap separation. iOS bundling passes. The browser API request still fails, so populated chart appearance and native live-update/gesture performance remain to be checked on a device.


## Interactive chart: pinch zoom and exact tick inspection

Swipe horizontally to browse recorded ticks; hold briefly before dragging to inspect a recorded tick. While a finger is held on the plot, a vertical crosshair, price dot and tooltip show that tick's integer-paise price and receipt time (including milliseconds). Lifting the final finger or cancelling the gesture clears the inspection readout immediately, preserving the zoom window. Selection searches the full raw history, including ticks omitted from the simplified SVG line; it never estimates a price between ticks. The chart is paused in an exploration window while inspecting, while the feed, last-price header and holdings keep updating. Reset returns to following live ticks. The time axis initially fits the session, then follows a rolling one-minute window to limit compression; older ticks remain available by swiping.

Two-finger pinch zooms between 1x and 16x around the finger midpoint. Moving the midpoint moves the time window within the recorded session. Per user preference, zoom is gesture-only: no +/- buttons or zoom multiplier are displayed. A compact Reset view action appears in the chart heading while exploring. Empty time intervals explicitly show that no ticks were recorded there; they do not fabricate points. The detail ScrollView is temporarily disabled only while the chart owns a gesture, then restored on release/cancellation. Screen-reader actions can step through received ticks.

`src/domain/chartInteraction.ts` contains pure viewport and selection math. `useChartInteraction.ts` handles touches, measurement and gesture lifecycle. `InteractiveTickChart.tsx` renders the data, crosshair and tooltip; `LiveTickChart.tsx` remains the feed/session wrapper. SVG geometry and crosshair coordinates use the same bounds so their price/time positions agree.

Ten additional tests bring the suite to 35, covering focal zoom/reversal, bounds/16x limits, degenerate gestures, nearest raw tick/ties, downsampling-independent inspection, empty windows, stable exploration under new ticks, touch coordinate conversion and crosshair alignment. A temporary local-only proxy to the public OHLC endpoint allowed the exported web app to be tested with real API prices and the actual simulator; production API code was unchanged. Populated chart tap/drag, exact price/time tooltips, 2x/4x zoom, zoom-out and Reset were verified in the mobile web preview. Web/iOS bundles build. Physical two-finger pinch and native gesture smoothness still need verification on a device.


## Step 5: local buy/sell

Stock detail has Buy/Sell actions and a keyboard-aware bottom sheet. Quantity must be a positive safe whole number; decimals, exponent notation, negatives, zero and unsafe values are rejected. Selling more shares than held is blocked, Max selects the current quantity, and an unavailable/non-positive quote disables trading. The estimated value follows live prices. Confirmation reads the latest quote again in the store, revalidates the latest holding and publishes the complete updated holdings array synchronously. A request ID and a synchronous UI guard make repeated confirmations idempotent. The receipt captures the actual fill price/value; it does not change with later ticks. All orders are local simulation; no broker endpoint is called.

`src/domain/trading.ts` contains pure input validation, transaction calculations and an injected-quote execution store. `src/state/holdings.ts` connects that store to React and the shared quote feed. Seed holdings are read only once. Portfolio rows, sorting, summary, detail positions and trade controls now use the same holdings store. Unchanged positions retain object identity, so a trade does not invalidate every row's props.

On a buy, cost basis increases by `quantity * fill price` and average cost is `new basis / new quantity`. The stored average may contain fractions of a paise; it is rounded only when displayed. The displayed average times quantity may therefore differ slightly from the exact invested amount. Summary invested/P&L values use the explicit cost basis and reconcile exactly with the row money amounts. Partial sells preserve average acquisition price and round the proportional remaining basis once to integer paise using BigInt division, avoiding floating-point ratio errors. A full sell removes the holding; rebuying starts a new position. Summary is for current holdings: realized sale P&L and cash balances are not tracked. Today's change remains the documented current-quantity versus previous-close calculation.

Trades and receipts are session-only and reset to the bundled holdings when the app restarts. Only the watchlist is persisted, as explicitly required by the brief. Order history, fees, account cash and cross-device sync are outside the core scope. While the feed is paused, simulated orders may fill at the last received price; the sheet discloses this. No price is fabricated if a quote is missing.

Sixteen transaction tests bring the suite to 51, covering strict quantities, repeated weighted buys, partial/full sells, exact half-paise/large-value allocation, overselling, missing/invalid prices, safe-integer limits, latest-price fills, atomic publication, idempotence, failure recovery, reference isolation, new/rebought positions and row/summary reconciliation. With real OHLC-seeded simulated prices in the local web proxy preview, UI checks covered invalid fractional quantity, buy 25→27 shares, oversized sale rejection, partial sell preserving the average, Max/full sell, portfolio row/count removal, exact invested-total reconciliation, OLDCO protection and creation of a new watched-stock position. The iOS bundle builds; native keyboard, device gestures and profiling remain unverified.


## Bonus 1: price-cell flash

Portfolio last-price cells and Watchlist price cells flash a subtle green on an increase or red on a decrease relative to the previous displayed price, then fade over 450 ms. This direction is independent of the position's gain/loss or day change. Initial quotes, unchanged prices, missing values, and remounts do not trigger a flash. The reusable `PriceFlash` component owns two background opacity layers; the text and row layout stay stable. A new price stops the previous animation before starting the correct direction, and unmount stops both animations.

On Android/iOS, `Animated.timing` uses the native driver so opacity frames run on the UI thread; detecting new prices and scheduling the animation still happens in JavaScript. `isInteraction: false` avoids holding the list's interaction queue open. Web uses the JS driver and does not demonstrate the UI-thread bonus. Reduce Motion disables flashes, including changes to the setting while the app is open. No new animation dependency was added. TypeScript, the 53 domain tests and iOS bundling are checked; native visual behavior, accessibility settings and performance still require device verification.

Remaining optional bonuses: reconnect/backoff with catch-up fetch, limit orders, persisted order history, and developer simulator controls.

## Sticky holdings controls

Search, sort options, direction and column headings form one sticky FlatList item. The expanded header and Summary scroll away; the controls pin directly below the reserved toolbar and return to their normal position when scrolling back to the top. The same input stays mounted while sticking, preserving focus and query. Empty searches use the list footer because the controls remain a real list item. Focusing search scrolls to the measured header boundary, and short results retain enough content height to keep that boundary reachable. No per-scroll React state or duplicate overlay input is used. Mobile web checks covered scrolling through different rows with controls pinned, empty results, filtering/clearing, sorting and returning to the top. Native sticky/keyboard behavior remains to be verified.
