## Why

The web app still redeclares shared status types, builds weekly reports with mutable dual accumulators, and shelters two oversized multi-job modules behind lint exceptions. The P2 inventory in `docs/reviews/2026-07-15-external-sweep.md` identifies these as concentrated drift and review-risk surfaces.

## What Changes

- Replace the `PeriodStatus` declarations in `shared/lib/admin-mock-data.ts`, `features/admin/model/admin-types.ts`, and `features/report-sections/ui/weekly-report-page-helpers.ts` with imports from `@customreport/shared`.
- Refactor `mapWeeklyReport` into pure per-product projections and small composition helpers with no mutable portfolio/products accumulators; keep functions at or below 50 lines.
- Split `print-report-template.tsx` into query/controller, portfolio table, lead section, executive summary, and print styles modules; remove its inline `max-lines` disable.
- Split `section-slide-utils.ts` by section model, activity model, pagination, foreign merge, and product-scoped jobs; remove its ESLint exemption.
- Preserve the public render/data contracts and add focused parity tests around extracted pure functions.

## Capabilities

### New Capabilities

- `web-module-hygiene`: Canonical web types, pure projections, cohesive module limits, and removal of lint escape hatches.

### Modified Capabilities

- None.

## Impact

Touches web report models, print route modules, slide model modules, tests, and `eslint.config.ts`. This is a behavior-preserving follow-up after/alongside `sweep15-live-report-type-ssot`; print/PDF readiness markers, slide pagination/merge semantics, and existing feature barrels remain stable.

## Non-goals

- No admin mock-type cleanup already owned by `admin-presentation-type-ssot`.
- No replacement of live dashboard/report presentation types or dead mock values owned by `sweep15-live-report-type-ssot`.
- No visual redesign of print output or slides.
