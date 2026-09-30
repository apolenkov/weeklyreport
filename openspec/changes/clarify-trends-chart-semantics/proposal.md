## Why

The Trends charts require legends and tooltips to read facts that already exist as a table. Visible tables make project status history and lead submissions readable together on desktop and narrow screens, using the same status vocabulary as the rest of the product. Published query data is correct; its presentation must expose the same facts to mouse, keyboard and assistive-technology users.

## What Changes

Replace Traffic-light history and Lead velocity charts with visible HTML tables: projects or leads are rows, full period end dates are columns. Reuse product status badges, prioritize projects whose worst status is Red or Yellow, and show submitted-section counts including muted zeroes. Make each table region keyboard-focusable, named by its section heading, and horizontally scrollable within the page. Preserve comparison dates and risk-change colours while reusing product status badges there too.

Remove Recharts, its unused UI wrapper, palette and design tokens. Import the concrete Trends table modules directly and retain local skeletons for pending queries. Update the web loading specification to match this route.

## Impact

Web Trends components, their focused tests, the shared UI package manifest and theme, workspace dependencies, design-token documentation, and the web-loading-performance specification. No analytics query, persistence or aggregation changes. Browser width, focus, native 200% zoom and selected screen-reader acceptance remain open until checked against current sources.
