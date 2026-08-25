## Why

The SDLC stages in a product card are currently compressed into one centered horizontal strip. As the number of stages grows, labels and status cues become harder to scan, while the card leaves useful width unused. Each stage needs a clear, full-width row with its existing icon and status treatment so a lead can understand the pipeline at a glance.

## What Changes

- Reflow visible SDLC stages into one vertically stacked row per stage, in the existing canonical order.
- Make every stage row fill the product card width and remain readable when labels are long.
- Preserve the existing stage icon, risk-derived status, lock/ownership behavior, tooltip, keyboard, and accessible-name semantics.
- Add a clear inline status visualization to each stretched row without introducing a second source of truth.
- Keep the existing collapsed `+N` indicator and Mine/Everyone filtering behavior.
- Replace horizontal-only spacing assumptions with stable row geometry that does not jump when a stage status or existing interaction changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-pipeline-card`: visible stage controls are presented as full-width vertical rows while preserving status derivation, ownership, completeness, and interaction requirements.

## Impact

- `apps/web/src/features/period/ui/sdlc-product-card.tsx` and `apps/web/src/features/report-sections/ui/stage-chip.tsx` change only presentation and composition of the existing stage controls.
- Focused pipeline and stage-chip tests will be updated to assert row count, full-width geometry, status visualization, and preserved interaction semantics.
- No API, database, permission, dependency, or data-model changes are required.
- Acceptance requires source-bound type/lint/unit checks plus fresh exact-SHA desktop Chrome screenshots and independent visual review; this UI change does not by itself close CR-001 runtime acceptance.
