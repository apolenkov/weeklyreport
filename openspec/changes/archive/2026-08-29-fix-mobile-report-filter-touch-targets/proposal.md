## Why

After the first mobile touch defects were repaired, the source-bound iPhone 14 pass reached the lead report's `Mine only` filter and measured it at 40 px wide, below the product's 44 px touch-target token. The failing C68 evidence is stored in `~/work/customreport-archive/2026-08-11-product-form-atlas/playwright-mvp-results/`.

## What Changes

- Give the lead report ownership-filter control and its directly paired option a minimum 44 px rendered width and height below the mobile breakpoint.
- Preserve compact desktop geometry, accessible names, selected state, and filtering behavior.
- Add focused component and source-bound browser evidence for the mobile dimensions.

### Non-goals

- No change to filter semantics, report data, or permissions.
- No redesign of unrelated lead-form controls.
- No API, database, or mutation changes.

## Capabilities

### New Capabilities

- `mobile-report-filter-touch-targets`: define responsive minimum target geometry for the lead report ownership filter.

### Modified Capabilities

None.

## Impact

The change affects the web ownership-filter control, its focused test, and source-bound Playwright visual evidence. It changes only responsive geometry.
