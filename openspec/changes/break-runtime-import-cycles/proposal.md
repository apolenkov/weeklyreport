# Break all 41 runtime import cycles

## Why

`pnpm depcruise` is red: 41 runtime circular-dependency errors (40 web, 1 api). Circular imports make module initialization order load-bearing and block wiring depcruise into the lint gate (quality-tooling burn-down, wave 5 — the last remaining wave).

## What Changes

Move-only refactor, zero behavior change:

- C1: `features/admin/ui/tab-header.tsx` (TabHeader/TabSearch/TabFilter) → `shared/ui/` — dissolves admin↔period and admin↔review.
- C2 (api): extract `resolveHumanSession`/`HumanSessionDeps` from `infrastructure/trpc/trpc.context.ts` into `lib/human-session.ts` — dissolves trpc.context↔pdf-export.
- C3: `features/period/ui/item-card-actions.tsx` → `features/report-sections/ui/` — removes the only report-sections→period runtime edges.
- C4: carve report-sections' page-assembly upper floor (lead-form* family, weekly-report* family, head-report-shell, product-accordion + their hooks/models/tests) into new slice `features/report-pages`; move `use-slide-inline-editor` + `slide-inline-editor-dialogs` into `features/slides`; report-sections shrinks to a pure lower floor (model + primitive UI). `webSlices` in eslint.config.ts gains `report-pages`.
- Wire the gate: root `lint` script += `pnpm depcruise && pnpm knip`; raise typecov floors to current headroom; fix the one knip duplicate-export finding.

Full file-precise execution map (import sites, barrel diffs, vi.mock hits): session artifact `carve-map.md` (archived with the arc handoff).

## Impact

- Affected: apps/web feature slices admin/period/report-sections/review/slides + new report-pages; apps/api trpc context + pdf-export; eslint.config.ts webSlices; root package.json lint script.
- No runtime behavior change; no API/schema change; no route change (catalog gate unaffected).
