## Why

BL-02 (P0), `docs/reviews/repo-excellence-review-2026-07-14.md`.

`filterSectionToSharedProducts`
(`apps/api/src/modules/report-sections/domain/lead-form-cross-author-scope.ts`,
lines 140-183) is documented (lines 133-138) as bounded by a ceiling: "this
shared-product lens never exposes a field the curated Everyone lens
(`CrossAuthorSectionRow`) omits." It honors that ceiling for `activities`
(emptied) and `reviews` (dropped) — but `items`, `risks`, and `decisions` are
only product-filtered; each retained record still carries its full
`comments[]` array (reviewer id, reviewer name, free-text comment, created
timestamp) verbatim from the section spread. `CrossAuthorSectionRow.items` /
`.risks` / `.decisions` (`lead-form-shared.ts`) declare no `comments` field
at all, so this genuine `getByPeriod` cross-author read discloses strictly
more than the module's own documented ceiling and more than the curated
Everyone lens ever shows: a co-lead sharing one product with another author
sees that author's reviewer identities and review comment text on items,
risks, and decisions.

## What Changes

- `filterSectionToSharedProducts` MUST strip `comments` from every retained
  `items[]`, `risks[]`, and `decisions[]` row, the same way it already
  strips `activities` and drops `reviews` — so the function's actual output
  matches its own documented ceiling.
- No change to which records are retained (the existing product-scoping
  filters are correct and untouched) — only to what each retained record
  discloses.

## Claim disposition

| Sub-claim                                                                           | Disposition   | Note                                                                                                                                                            |
| ----------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `comments[]` on items/risks/decisions survives the shared-product filter unstripped | **Confirmed** | read directly from `filterSectionToSharedProducts` source                                                                                                       |
| The function's own docblock ceiling claim is currently false for `comments`         | **Confirmed** | docblock says "never exposes a field the curated Everyone lens omits"; `comments` is such a field                                                               |
| This is an auth bypass (co-lead reaches records they should not access at all)      | **Refuted**   | scope is confined to records the co-lead already co-owns via a shared product — this is over-disclosure within an authorized read, not a broken access boundary |
| Product-scoping (which records are retained) needs to change                        | **Refuted**   | filters on `items`/`risks`/`decisions`/`projects` by shared product id are correct and out of scope                                                             |

## Non-goals

- Not changing which products/records a co-lead can see — only stripping the
  `comments` field from records already in scope. A test MUST pin that
  product-scoping is unaffected (see Verification).
- Not touching the status-only `CrossAuthorStatusRow` path or the curated
  Everyone-lens (`CrossAuthorSectionRow`) construction itself — those already
  omit comments by construction; this change only fixes the
  `getByPeriod`/`filterSectionToSharedProducts` full-section read.
- Not stripping `activities` or `reviews` differently than today — those are
  already correctly handled and untouched.
- Not adding a `comments` field to `CrossAuthorSectionRow` as an alternative
  fix (i.e. not deciding to widen the Everyone lens to match the leak instead
  of narrowing the leak to match the lens) — the review's stated ceiling is
  the Everyone lens, and narrowing to it is the documented intent.

## File manifest

- `apps/api/src/modules/report-sections/domain/lead-form-cross-author-scope.ts`
  — strip `comments` from items/risks/decisions inside
  `filterSectionToSharedProducts`.
- A new or existing test file exercising `filterSectionToSharedProducts`
  directly (none currently exists under
  `apps/api/src/modules/report-sections/domain/`; check for one alongside
  `lead-form-shared.test.ts` or create
  `lead-form-cross-author-scope.test.ts`) — asserts `comments` is absent on
  every retained items/risks/decisions row post-filter, while product
  scoping and the existing activities/reviews stripping are unchanged.
- `apps/api/src/modules/report-sections/application/lead-form.service.ts` —
  read-only reference (calls `filterSectionToSharedProducts` at line 277);
  not expected to change.
- `apps/api/src/modules/report-sections/application/lead-form.service.test.ts`
  (if it exists — check) — add/confirm an integration-level assertion that a
  `getByPeriod` cross-author read carries no `comments` on any record.

## Verification

- `pnpm --filter @customreport/api db:generate`
- `pnpm typecheck && pnpm lint && pnpm test`
- `cd apps/api && pnpm test:integration` — this is a DB-backed authz read
  path (`getByPeriod` cross-author lens); run the integration suite to
  confirm the fix holds against real Prisma-shaped data, not just the unit
  fixture.
- Manual/live check (optional but recommended given P0 severity): as a lead
  sharing exactly one product with a co-lead who has review comments on that
  product's items, call `leadForm.byPeriod` for the co-lead's section and
  confirm the response JSON has no `comments` key populated on any item,
  risk, or decision.

## Sequencing

No dependency on `lead-draft-save-integrity` (BL-01) — different subsystem
(API authz vs. web draft pipeline), can land independently and in parallel.
