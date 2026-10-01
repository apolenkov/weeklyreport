## 1. Correct Trends presentation

- [x] 1.1 Replace history and velocity charts with visible semantic tables, named keyboard-focusable scroll regions, full period dates, stable worst-status-first project rows, and product status badges. Bound the table wrappers and Trends page width.
- [x] 1.2 Reuse product status badges in period comparison, preserve exact comparison dates and risk-change colours, import concrete Trends modules directly, and remove Recharts with its unused wrapper, palette, tokens and dependency entries.
- [x] 1.3 Verify table captions, column and row headers, status labels, submission pivot integrity, stable immutable sorting, keyboard region focus, unchanged comparison dates and risk-change colours, local query-loading skeletons, focused tests and scoped quality checks.
- [x] 1.4 Verify current-source browser widths (375, 1024, 1440 and 1728 CSS pixels), internal table scrolling, no document overflow and visible keyboard focus. Native 200% zoom and the selected screen reader remain on TASK-145.11.02. Historical chart screenshots and tooltip checks do not prove the new table UI; the tooltip-at-1280 check is moot because the charts became tables. Verified 2026-10-01 in agent-browser Chromium (375, 1024, 1440, 1728) after publish and reload; native 200% zoom and VoiceOver were confirmed by the owner.

## 2. Address table feedback

- [x] 2.1 Keep all captions sr-only, move comparison dates above its scroll wrapper, prevent status badge wrapping and give comparison the same named keyboard-focusable region and green focus indicator. Replace cheap stale chart names and Loading chart text. Restore the durable web-loading-performance baseline and retain the pending requirement change only in this change.
- [x] 2.2 Keep the first name column sticky with an opaque existing background in all three tables.
- [x] 2.3 Add latest-week badge counts including nonzero No status, an existing subtle surface on the latest history column, and muted Recovered/Slipped markers between known statuses using shared severity; hide decorative arrows.
- [x] 2.4 Present the unchanged leadVelocity API as Lead submissions: Submitted for positive values and muted Missing for zero or absent values; preserve distinct lead IDs.
- [x] 2.5 Verify summary counts, marker direction and unknown/one-period cases, sticky name columns, hidden captions, comparison explanation/nowrap/named focus, submission labels and local Loading data states with focused tests and scoped quality checks. Browser acceptance remains open in 1.4.

Post-commit acceptance runs typecheck, lint, format:check, test and spec:check sequentially with exact-SHA evidence outside the repository. Build and commands writing .next are excluded while the owner's dev server runs.
