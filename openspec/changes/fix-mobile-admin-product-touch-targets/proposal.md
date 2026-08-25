## Why

Once the lead-form mobile controls passed, the aggregated source-bound iPhone 14 run reached the admin Products tab and found every product row's stage-disclosure control at 28×28 px and its Edit and Archive actions at 34 px high. The complete repeated C68 measurement is recorded in `~/work/customreport-archive/2026-08-11-product-form-atlas/playwright-mvp-results/`.

## What Changes

- Give each product row's stage-assignment disclosure, Edit, and Archive controls a 44 px minimum rendered width and height below the mobile breakpoint.
- Preserve desktop table density, accessible names, expanded state, edit behavior, archive behavior, and disabled states.
- Keep the Products tab within the mobile viewport after enlarging the repeated controls.
- Add focused component and aggregated source-bound browser evidence.

### Non-goals

- No redesign of other admin tabs or product management workflows.
- No change to product data, stage assignments, archive mutations, API, database, or authorization.
- No blanket change to every compact button in the application.

## Capabilities

### New Capabilities

- `mobile-admin-product-touch-targets`: define mobile target geometry and fit for repeated product-row controls in the admin Products tab.

### Modified Capabilities

None.

## Impact

The change affects the web admin product-row controls, their direct tests, and source-bound Playwright visual evidence. It changes only responsive geometry.
