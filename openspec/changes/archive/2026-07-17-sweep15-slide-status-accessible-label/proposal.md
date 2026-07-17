## Why

Product status on slides is currently conveyed only by a colored stripe and dot, so color-vision-deficient users and projected audiences can miss it. P1-7 in `docs/reviews/2026-07-15-external-sweep.md` confirms this is mandated by the current spec and therefore requires a contract change.

## What Changes

- Replace the color-only product-card mandate with a compact, shape-distinct status icon plus accessible English status text beside each product name.
- Keep the existing status stripe as redundant reinforcement.
- Preserve the collapsed no-status row without inventing a status.
- Add model/render tests for blocked, at-risk, on-track, and no-status products, including accessible-name assertions that do not depend on color.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `lead-slide-by-product-grid`: product cards must expose status by shape and accessible text as well as color.

## Impact

- Spec delta for `lead-slide-by-product-grid`.
- Web slide article/status presentation and focused accessibility tests.
- No status derivation, token, slide layout, API, or schema changes.

## Non-goals

- Adding a large textual chip that materially increases slide density.
- Removing the status stripe or changing status colors.
- Changing product status calculation.
