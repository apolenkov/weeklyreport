## Why

BL-24 (P2) sub-finding (a) from `docs/reviews/repo-excellence-review-2026-07-14.md`
— the admin presentation-types-vs-mock-data half only (the
`RecordStageStep`/`RiskStageStep` half is a separate change,
`stage-step-component-dedup`).

`apps/web/src/features/admin/model/admin-types.ts` documents itself in its
top-of-file comment as intentionally self-contained:

> These are intentionally self-contained re-declarations so downstream
> consumers do not couple to a particular UI module
> (`apps/web/src/shared/lib/admin-mock-data.ts`).

It already declares `MockUser`, `MockGroup`, and `MockProduct` (confirmed:
`admin-types.ts` lines 17, 37, 50). But three sibling model files import the
mock-data versions instead:

- `apps/web/src/features/admin/model/group-form.ts` — `import type {
MockGroup } from "../../../shared/lib/admin-mock-data"`
- `apps/web/src/features/admin/model/product-form.ts` — `import type {
MockProduct } from "../../../shared/lib/admin-mock-data"`
- `apps/web/src/features/admin/model/user-form.ts` — `import type {
MockGroup, MockUser } from "../../../shared/lib/admin-mock-data"`

This is the same failure class already fixed once for the admin Reminders
tab in `openspec/changes/archive/2026-07-13-web-type-ssot-drift` (which
added the `web-model-type-boundary` requirement this change extends) —
three more admin model files still point at the mock module the same spec
already says not to couple to. Nothing enforces the two type sets stay in
sync; a future `admin-types.ts` field change would not surface a compile
error in these three files.

## What Changes

- `group-form.ts`, `product-form.ts`, `user-form.ts`: repoint the
  `MockGroup`/`MockProduct`/`MockUser` type imports from
  `../../../shared/lib/admin-mock-data` to `./admin-types`.
- Fix `admin-mock-data.ts` remaining consumers if any additional stragglers
  turn up during implementation (see Non-goals — expected to be a closed
  set of three files based on the grep evidence below, but the task list
  includes a re-grep step to catch anything missed).

## Claim disposition

| Claim (review doc)                                                                     | Disposition                                                                                                                                                                                           | Evidence                                                        |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `group-form.ts`/`product-form.ts`/`user-form.ts` import `Mock*` from `admin-mock-data` | CONFIRMED                                                                                                                                                                                             | grep on each file's import line, quoted above                   |
| This contradicts `admin-types.ts`'s stated self-contained purpose                      | CONFIRMED                                                                                                                                                                                             | `admin-types.ts` top-of-file doc comment, verbatim quoted above |
| The two type sets are field-for-field duplicates with nothing enforcing sync           | CONFIRMED (by inspection) — `MockUser`/`MockGroup`/`MockProduct` are separately declared in both `admin-types.ts` and `admin-mock-data.ts`; no shared base type or generated sync exists between them |

## Non-goals

- Not deleting or deduplicating `admin-mock-data.ts` itself — it still
  backs other mock/demo call sites outside the three files above (this
  mirrors the explicit non-goal already recorded in the archived
  `2026-07-13-web-type-ssot-drift` change for the same module).
- Not touching `reminders-tab-format.ts`, `reminders-form-state.ts`, or
  `reminders-tab-mutations.ts` — already fixed by the archived change.
- Not touching `admin.ts`'s mapper — it already imports from
  `admin-types.ts`.
- Not extracting the `RecordStageStep`/`RiskStageStep` duplication — that
  is `stage-step-component-dedup`, a separate seam with a separate spec
  target and no shared files with this change.
- Not adding a compile-time or lint-time guard that would forbid importing
  `admin-mock-data` types from `features/admin/model/*` — the existing
  `web-model-type-boundary` spec requirement (prose-enforced, reviewed at
  change time) is the mechanism already chosen for this class of drift;
  introducing a new lint rule is out of scope for a bugfix-sized change.

## File manifest

- `apps/web/src/features/admin/model/group-form.ts` — import repoint.
- `apps/web/src/features/admin/model/product-form.ts` — import repoint.
- `apps/web/src/features/admin/model/user-form.ts` — import repoint.
- No test files exist today for `group-form.ts`, `product-form.ts`, or
  `user-form.ts` (confirmed: no `*-form.test.ts` siblings in
  `apps/web/src/features/admin/model/`). No new test files are added — this
  is a pure type-import repoint with no behavior change; `tsc` is the
  verification mechanism (an accidental shape divergence between the two
  `Mock*` families would surface as a type error the moment the import
  target changes, which is exactly the property this change restores).
- No barrel changes — `admin-types.ts` and the three model files are
  already siblings inside the `admin` feature slice.

## Verification

This is a type-only refactor (no runtime behavior changes: `MockGroup`,
`MockProduct`, `MockUser` in `admin-types.ts` are structurally compatible
today per the review's own "field-for-field duplicate" finding). The bar is
the full gate, not a live-browser drive:

1. `pnpm --filter @customreport/api db:generate`
2. `pnpm typecheck` — the load-bearing check: if `admin-types.ts`'s
   declarations have silently drifted from `admin-mock-data.ts`'s despite
   looking identical in the review's read, this is where it surfaces.
3. `pnpm lint && pnpm test`
4. `pnpm build` (webpack) — belt-and-braces per the barrel-freeze posture
   for this batch, even though no barrel is touched.
5. Manual spot-check: open the admin Groups/Products/Users tabs in a
   dev-from-source app and confirm the edit forms still render and submit
   (behavior parity, since the change is import-only).

## Sequencing

Standalone. No shared files with `stage-step-component-dedup` (the other
BL-24 half — different files, different feature-slice areas) or with either
of the other two changes in this batch.
