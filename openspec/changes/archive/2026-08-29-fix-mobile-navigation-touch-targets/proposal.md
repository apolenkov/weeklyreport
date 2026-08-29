## Why

The source-bound MVP visual pass found that the Theme, Language, and Sign out controls in the top navigation remain 32 px high on a 390 px mobile viewport, below the product's 44 px touch-target token. The failing runtime evidence is in `~/work/customreport-archive/2026-08-11-product-form-atlas/playwright-mvp-results/`, while the existing token contract lives in `packages/ui/src/styles/theme.css`.

## What Changes

- Make every actionable or inert icon control in the signed-in navigation right rail use the shared toolbar height, which resolves to 44 px below the mobile breakpoint and remains compact on desktop.
- Keep the Theme and Language controls inert, accessible, and visually consistent with the existing deferred-feature pattern.
- Align the loading skeleton with the same responsive geometry so hydration does not shift the rail.
- Add component and browser evidence for the mobile target size without changing navigation behavior.

### Non-goals

- No implementation of theme or language selection.
- No redesign of the navigation information architecture or desktop density.
- No broad touch-target cleanup outside the signed-in navigation rail.

## Capabilities

### New Capabilities

- `mobile-navigation-touch-targets`: define responsive minimum target geometry for the signed-in navigation right rail and its loading skeleton.

### Modified Capabilities

None.

## Impact

The change affects the shared Coming Soon icon primitive, the web navigation Sign out control and loading skeleton, focused component tests, and source-bound Playwright visual evidence. It changes no API, database, authorization, route, or mutation behavior.
