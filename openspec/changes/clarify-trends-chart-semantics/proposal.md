## Why

Desktop audit UX-14, UX-15, UX-25 and UX-26 confirmed missing comparison dates, hidden tables expanding the page, numeric status tooltips, and focusable charts under aria-hidden. Published query data is correct; its presentation must explain the same facts to mouse, keyboard and assistive-technology users.

## What Changes

Name the interactive charts and expose them to accessibility APIs; preserve Recharts keyboard navigation and the complete text-table alternative. Hide the alternative through a clipped non-table container. Reuse domain status labels in tooltips. Show comparison period dates and the direction of risk change from the exact queried pair.

## Impact

Web Trends components and their focused tests. No analytics query, persistence, aggregation, palette or mobile redesign changes.
