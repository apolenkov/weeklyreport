# Proposal

## Why

Portfolio lead and product buttons currently contain `div` descendants, which violate the native button phrasing-content contract. C5025 has a schema-admitted public-render RED for active product, lead and empty product cards; see the external D37-V24 handoff.

## What Changes

- Render the existing badge, text body, name and status containers as phrasing elements, preserving their display and the native button behavior.
- Clarify native button content in the existing report-card-clarity contract.
- Add public schema-to-mapper-to-render checks with active and empty navigation controls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-card-clarity`: portfolio navigation buttons use valid phrasing descendants.

## Impact

`portfolio-overview-cards.tsx` and its existing public overview test. No API, dependency or persistence changes. Existing `portfolio-content-presence` controls remain authoritative.

## Non-goals

- New empty-card policy, labels, glyph semantics or focus behavior.
- Claims of browser layout, hydration or assistive-technology acceptance from JSDOM.
