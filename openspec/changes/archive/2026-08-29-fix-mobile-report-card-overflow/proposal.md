## Why

The source-bound iPhone 14 visual trace shows the lead form's `Current week items` board shifted 52 px horizontally, cutting off the left side of product names, status badges, and item text. The C68 evidence is stored in `~/work/customreport-archive/2026-08-11-product-form-atlas/playwright-mvp-results/`, and the variant inventory requires mobile lead-form content to remain fully visible.

## What Changes

- Reflow item-card metadata and actions on narrow viewports so cards fit their current-week and next-week board containers.
- Keep every item action visible, named, and at least 44 px in both dimensions on mobile.
- Preserve the established desktop card layout and all item lifecycle behavior.
- Add focused component and source-bound browser checks for nested horizontal overflow, including after an item dialog closes.

### Non-goals

- No hiding of overflow or removal of item actions to mask the defect.
- No redesign of the whole lead form or fixed completion rail.
- No API, database, authorization, or mutation changes.

## Capabilities

### New Capabilities

- `mobile-report-card-layout`: define mobile fit, readable content, and action accessibility for lead report item cards and their board containers.

### Modified Capabilities

None.

## Impact

The change affects lead report item-card layout, direct component tests, and source-bound Playwright visual evidence. It changes only responsive presentation.
