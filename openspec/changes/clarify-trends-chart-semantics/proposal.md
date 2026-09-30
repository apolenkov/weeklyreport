## Why

The Trends charts require legends and tooltips to read facts that already exist as a table. Visible tables make project status history and lead submissions readable together on desktop and narrow screens, using the same status vocabulary as the rest of the product. The latest week needs a clear summary and meaningful change indicators; names must remain visible while periods scroll. The current lead query reports submission presence, so its presentation must not imply velocity. Differences between analytics queries are a separate API concern.

## What Changes

Replace Traffic-light history and Lead velocity charts with visible HTML tables: projects or leads are rows, full period end dates are columns. Reuse product status badges and prioritize projects whose worst status is Red or Yellow. Rename the lead surface Lead submissions and show Submitted for positive values and muted Missing for zeroes. Make all three table regions keyboard-focusable, named by their section heading, and horizontally scrollable within the page. Keep their first name column sticky with an opaque existing background. Preserve comparison dates and risk-change colours; place its date explanation above the scrolling region and keep status badges on one line. Keep captions available to assistive technology without duplicating visible headings.

Summarize the latest history period with nonzero status counts and existing badges, including No status. Tint its header and cells with an existing muted surface. Show muted Recovered or Slipped text only when the latest known status improves or worsens versus the preceding displayed known status; hide decorative arrows from assistive technology. No new palettes, tokens or components.

Remove Recharts, its unused UI wrapper, palette and design tokens. Import the concrete Trends table modules directly and retain local skeletons labelled Loading data for pending queries. Replace cheap remaining chart names with table terminology. Keep the web loading requirement change in this active delta; restore the durable specification until this change is synchronized.

## Impact

Web Trends components, their focused tests, the shared UI package manifest and theme, workspace dependencies, design-token documentation, and the web-loading-performance specification. No analytics query, persistence or aggregation changes. Browser width, focus, native 200% zoom and selected screen-reader acceptance remain open until checked against current sources.
