## Why

The source-bound mobile visual pass found that the lead form's primary `Fill from most recent submitted period` segment renders 42 px high on an iPhone-sized viewport, below the product's 44 px touch-target token. The failing C68 evidence and screenshot are recorded in `~/work/customreport-archive/2026-08-11-product-form-atlas/playwright-mvp-results/`.

## What Changes

- Give both actionable segments of the lead form's Fill From split button an explicit 44 px minimum rendered size below the mobile breakpoint.
- Preserve the existing compact desktop toolbar geometry and all Fill From behavior, labels, menu semantics, and authorization.
- Add focused component and source-bound browser evidence for the mobile target size and horizontal fit.

### Non-goals

- No redesign of the lead form, period navigation, or mobile toolbar.
- No broad touch-target cleanup outside the Fill From split button.
- No API, database, authorization, or mutation changes.

## Capabilities

### New Capabilities

- `mobile-fill-touch-targets`: define responsive minimum target geometry for both actionable segments of the lead form's Fill From split button.

### Modified Capabilities

None.

## Impact

The change affects the web Fill From split-button component, its focused test, and the source-bound Playwright visual evidence. It changes only rendered geometry.
