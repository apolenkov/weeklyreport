## Why

After earlier mobile target fixes, the aggregated source-bound iPhone 14 pass found the four lead-form section collapse controls at 40×40 px and the primary `Submit report` action at 40 px high, below the product's 44 px touch-target token. The complete C68 measurement is recorded in `~/work/customreport-archive/2026-08-11-product-form-atlas/playwright-mvp-results/`.

## What Changes

- Give the Current Week, Next Week, Risks & Blockers, and Decisions collapse/expand controls a 44 px minimum rendered size below the mobile breakpoint.
- Give every actionable button in the lead form's sticky completion rail a 44 px minimum height and width below the mobile breakpoint.
- Preserve desktop density, accessible names, disabled states, section behavior, and report submission behavior.
- Add focused component and aggregated source-bound browser evidence.

### Non-goals

- No redesign of section headers or the sticky completion rail.
- No change to report submission, section state, API, database, or authorization.
- No measurement of the Next.js development-tools button as a product control.

## Capabilities

### New Capabilities

- `mobile-lead-section-touch-targets`: define mobile target geometry for lead-form section toggles and sticky completion actions.

### Modified Capabilities

None.

## Impact

The change affects shared lead-form section controls, sticky completion actions, their direct tests, and source-bound Playwright visual evidence. It changes only responsive geometry.
