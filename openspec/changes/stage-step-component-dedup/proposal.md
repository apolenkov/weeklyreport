## Why

BL-24 (P2) sub-finding (b) from `docs/reviews/repo-excellence-review-2026-07-14.md`
— the `RecordStageStep`/`RiskStageStep` duplication half only (the admin
presentation-types-vs-mock-data half is a separate change,
`admin-presentation-type-ssot`).

`RecordStageStep` (`apps/web/src/features/period/ui/record-stage-step.tsx`)
and `RiskStageStep` (`apps/web/src/features/review/ui/risk-stage-step.tsx`)
are near-identical components: both render `StageMultiSelect` (imported from
`../../report-sections` in both files) plus a `role="status"` dead-end
notice paragraph shown when `isDeadEnd`, both carry the identical "Suppress
the stale required-stage error in the dead-end branch" comment, and both
suppress `error` in the dead-end branch the same way. They differ only in:

- `RecordStageStep` takes `id` and `parentName` (notice text: `No stages
assigned on ${parentName} — contact admin.`); `RiskStageStep` hardcodes
  `id="risk-stage"` and a parent-less notice (`No stages assigned — contact
admin.`).
- `RiskStageStep` additionally passes `previewSeverity={severity}` to
  `StageMultiSelect`; `RecordStageStep` does not.

Nothing enforces the two stay behaviorally in sync — a future
dead-end-notice wording or suppression-logic change applied to one would
silently not apply to the other.

**Cross-slice seam.** `RecordStageStep` is consumed both inside its own
`period` slice (`decision-edit-dialog-fields.tsx`) and from
`report-sections` (`item-edit-dialog-fields.tsx`), exported through
`period`'s barrel (`apps/web/src/features/period/index.ts`). `RiskStageStep`
is consumed only inside its own `review` slice
(`risk-edit-dialog-fields.tsx`) and is not exported through `review`'s
barrel today. Both consuming files already import `StageMultiSelect` from
`report-sections` — `report-sections` is already a shared dependency of
`period` and `review`, and the barrel-boundary mechanism generates its
zone allowlist from each slice's own `index.ts` (`docs/adr/0016`), so
adding the shared primitive's export to `report-sections/index.ts`
requires no new zone/allowlist edit. Landing it in `period` or `review`
instead would require a _new_ cross-slice edge from the other slice into a
UI-only file, which the barrel-freeze posture for this batch (ADR-0016)
says not to add unless the fix strictly needs it — it doesn't, since
`report-sections` is already the natural shared home.

## What Changes

- Add a shared `StageStep` primitive to `apps/web/src/features/report-sections/ui/`
  (co-located with `stage-multi-select.tsx`, which it wraps), parameterized
  by `id`, `stageIds`, `availableStages`, `isDeadEnd`, `error`, `onChange`,
  an optional `previewSeverity`, and a `deadEndNotice: ReactNode` the caller
  supplies (so the two callers' different notice text is a call-site
  concern, not a branch inside the shared component).
- Export `StageStep` from `report-sections/index.ts`.
- `period/ui/decision-edit-dialog-fields.tsx` and
  `report-sections/ui/item-edit-dialog-fields.tsx`: switch from
  `RecordStageStep` (via `period`'s barrel) to `StageStep` (via
  `report-sections`, already imported in both files for other symbols),
  passing `deadEndNotice={`No stages assigned on ${parentName} — contact
  admin.`}` at the call site.
- `review/ui/risk-edit-dialog-fields.tsx`: switch from `RiskStageStep` to
  `StageStep`, passing `id="risk-stage"`, `previewSeverity={severity}`, and
  `deadEndNotice="No stages assigned — contact admin."`.
- Delete `apps/web/src/features/period/ui/record-stage-step.tsx` and its
  export from `period/index.ts`.
- Delete `apps/web/src/features/review/ui/risk-stage-step.tsx` (it was
  never exported from `review/index.ts`, so no barrel edit needed there).

Net barrel delta: **one new export added** to `report-sections/index.ts`
(`StageStep`), **one export removed** from `period/index.ts`
(`RecordStageStep`). No new export from `review` (it had none for this
symbol). This is the minimum edge change the fix needs — no export is added
beyond what the two consuming call sites require.

## Claim disposition

| Claim (review doc)                                                             | Disposition                                                                                                                                                                                                                                                               | Evidence                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RecordStageStep` and `RiskStageStep` are near-identical duplicated components | CONFIRMED                                                                                                                                                                                                                                                                 | both files read side by side: same `StageMultiSelect` wrap, same dead-end notice paragraph, same error-suppression comment verbatim                                                                                                                                                                                                         |
| Same dead-end 'contact admin' notice, same error-suppression comment           | CONFIRMED                                                                                                                                                                                                                                                                 | comment text `// Suppress the stale required-stage error in the dead-end branch so it never co-renders with the contact-admin notice below.` appears identically in both files                                                                                                                                                              |
| Differ only in `previewSeverity` and notice text                               | CONFIRMED, plus one more difference not called out in the review: `RecordStageStep` also takes `id`/`parentName` as props while `RiskStageStep` hardcodes `id="risk-stage"` and has no parent-scoped notice variant — folded into the shared component's parameterization |
| Split across the period and review feature slices                              | CONFIRMED                                                                                                                                                                                                                                                                 | `apps/web/src/features/period/ui/record-stage-step.tsx` vs `apps/web/src/features/review/ui/risk-stage-step.tsx`                                                                                                                                                                                                                            |
| Weigh the cross-slice seam (packages/ui or report-sections)                    | ADDRESSED                                                                                                                                                                                                                                                                 | chose `report-sections` over `packages/ui`: both consumers already depend on `report-sections` for `StageMultiSelect`, so no new dependency direction is introduced; `packages/ui` would pull a feature-specific (SDLC stage) concept into a cross-app design-system package, which is a larger and unnecessary move for a two-caller dedup |

## Non-goals

- Not touching `StageMultiSelect` itself (`report-sections/ui/stage-multi-select.tsx`)
  — `StageStep` wraps it unchanged.
- Not moving the shared primitive to `packages/ui` — see disposition table;
  it is a report-sections-scoped presentation concept (SDLC stage
  selection tied to `ReportSection` semantics), not a generic design-system
  primitive.
- Not touching the admin presentation-types-vs-mock-data half of BL-24 —
  that is `admin-presentation-type-ssot`, disjoint files.
- Not adding any new cross-slice export beyond the single `StageStep`
  export from `report-sections` — no new zone/allowlist edit is required
  because the zone mechanism is generated from each slice's own barrel
  (ADR-0016); this change adds one export and removes one, net one.
- Not changing `decision-edit-dialog-fields.tsx`'s or
  `risk-edit-dialog-fields.tsx`'s other props/behavior — scoped to the
  stage-step call site only.

## File manifest

- `apps/web/src/features/report-sections/ui/stage-step.tsx` (new) — shared
  `StageStep` component.
- `apps/web/src/features/report-sections/ui/stage-step.test.tsx` (new) —
  unit coverage: renders `StageMultiSelect` with the given props, shows the
  caller-supplied `deadEndNotice` exactly when `isDeadEnd`, suppresses
  `error` in the dead-end branch, forwards `previewSeverity` when given.
- `apps/web/src/features/report-sections/index.ts` — export `StageStep`.
- `apps/web/src/features/period/ui/decision-edit-dialog-fields.tsx` — swap
  `RecordStageStep` for `StageStep` with a `parentName`-interpolated
  `deadEndNotice`.
- `apps/web/src/features/period/ui/decision-edit-dialog.test.tsx` — no
  behavior change expected; re-run to confirm the dead-end notice still
  renders with identical text through the new call site.
- `apps/web/src/features/report-sections/ui/item-edit-dialog-fields.tsx` —
  same swap.
- `apps/web/src/features/report-sections/ui/item-edit-dialog.test.tsx` —
  re-run, same expectation as above.
- `apps/web/src/features/review/ui/risk-edit-dialog-fields.tsx` — swap
  `RiskStageStep` for `StageStep` with `previewSeverity` and the
  parent-less `deadEndNotice`.
- `apps/web/src/features/review/ui/risk-edit-dialog.test.tsx` — re-run,
  same expectation.
- Delete: `apps/web/src/features/period/ui/record-stage-step.tsx`.
- Delete: `apps/web/src/features/review/ui/risk-stage-step.tsx`.
- `apps/web/src/features/period/index.ts` — remove the `RecordStageStep`
  export line.

## Verification

This is a refactor (no intended behavior change) — the bar is the full gate
plus the four affected unit suites, plus `pnpm build` because the change
touches barrel exports (removing one, adding one) and ADR-0016 names
webpack as the real gate for barrel-boundary changes:

1. `pnpm --filter @customreport/api db:generate`
2. `cd apps/web && pnpm exec vitest run src/features/report-sections/ui/stage-step.test.tsx src/features/period/ui/decision-edit-dialog.test.tsx src/features/report-sections/ui/item-edit-dialog.test.tsx src/features/review/ui/risk-edit-dialog.test.tsx`
3. `pnpm typecheck && pnpm lint && pnpm test`
4. `pnpm build` — confirms no cycle/TDZ regression from the barrel edit
   (webpack evaluates whole barrels per ADR-0016's documented cost model)
5. Manual spot-check: open the Item, Decision, and Risk edit dialogs on a
   product whose stages have all been unassigned (the dead-end path) from a
   dev-from-source app; confirm each still shows its own contact-admin
   notice text unchanged.

## Sequencing

Standalone. No shared files with `admin-presentation-type-ssot` (disjoint
areas of BL-24), `viewer-period-navigator-scope`, or `slides-react-defects`.
