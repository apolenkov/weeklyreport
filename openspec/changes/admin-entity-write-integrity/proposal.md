## Why

BL-10, P1, `docs/reviews/repo-excellence-review-2026-07-14.md`. Scope is
narrowed per the review's own "Orchestrator amendments" (normative): the
`samlId` synchronization recommendation is REJECTED — see Non-goals. Only
the P2002 handling on `attachProductToGroup` (and the equivalent race
already latent in `upsertUser`'s create path) is in scope.

`attachProductToGroup` (`apps/api/src/modules/admin/admin-group-product.queries.ts:27-47`)
does `findUnique`-then-`create` inside a `$transaction` with no unique-
violation handling. A concurrent or double-click first-attach of the same
product races the `GroupProduct.productId` unique constraint and the loser
gets a raw, unhandled 500 instead of the friendly
`AdminGroupProductConflictError` its sibling `detachProductFromGroup`
avoids by construction (idempotent `deleteMany`) and
`upsertStageAssignmentRow` (`admin-group.queries.ts`, ~103-126) already
handles via `isUniqueViolation` + fallback update. `upsertUser`
(`admin-entity-write.queries.ts:35-68`) has the same class of gap: its
`create` branch sets `samlId: user.email` with no P2002 catch, so a
concurrent create racing on the seeded `samlId`/email unique constraint also
surfaces raw.

## What Changes

- `attachProductToGroup`: catch the unique-violation on the `create` (via
  the shared `isUniqueViolation` helper from
  `apps/api/src/lib/prisma-unique-violation.ts`, matching the
  `upsertStageAssignmentRow` pattern) and resolve it to either the existing
  row (idempotent re-attach) or a typed `AdminGroupProductConflictError`,
  instead of letting the raw P2002 propagate.
- `upsertUser`'s `create` branch: catch the unique-violation on the
  `samlId`/email collision and return a typed conflict instead of a raw 500.
  This does NOT change what `upsertUser` writes on the update branch — see
  Non-goals.

## Claim disposition

| Claim (review doc)                                            | Disposition                                                       | Note                                                                                                                                                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attachProductToGroup` unguarded P2002 race                   | CONFIRMED                                                         | `findUnique`-then-`create` in `$transaction`, no unique-violation handling; `detachProductFromGroup` and `upsertStageAssignmentRow` both handle their races, this one doesn't.   |
| `upsertUser` create-branch samlId/email unique race → raw 500 | CONFIRMED                                                         | `prisma.user.upsert` create sets `samlId: user.email`, no try/catch anywhere in the function.                                                                                    |
| Sync `samlId` to the new email on admin edit                  | **REJECTED** (council/Codex, ratified in orchestrator amendments) | `samlId` is the external SAML identity key, intentionally create-only; rewriting it on email edit would break identity mapping against the IdP. Not implemented — see Non-goals. |

## Non-goals

- **`samlId` is NOT synchronized to email on update.** It is the external
  SAML identity key, seeded from email only at creation, and is intentionally
  create-only thereafter — rewriting it on an admin email edit would corrupt
  the mapping back to the SAML IdP's assertion for that user. This change
  adds a preservation test (task 2.3 below) specifically to keep this
  decision from silently regressing later.
- Not touching `admin-snapshot-write.queries.ts`'s `upsertUsers` — the review
  notes the "same create-only asymmetry" there but the P2002-handling ask in
  scope for this change is limited to the two live-write paths
  (`admin-entity-write.queries.ts`, `admin-group-product.queries.ts`); the
  snapshot-restore path is out of scope (it also isn't a race-prone
  concurrent-user surface — restores are single-actor, admin-triggered).
- Not changing `detachProductFromGroup` or `upsertStageAssignmentRow` — they
  already handle their races correctly and are the reference pattern, not a
  target.

## File manifest

- `apps/api/src/modules/admin/admin-group-product.queries.ts` —
  `attachProductToGroup` (27-47): add `isUniqueViolation` catch + resolve.
- `apps/api/src/modules/admin/admin-entity-write.queries.ts` — `upsertUser`
  (35-68): add `isUniqueViolation` catch on the create branch.
- `apps/api/src/lib/prisma-unique-violation.ts` — read-only reference for
  `isUniqueViolation`/`PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE`; no change.
- `apps/api/src/modules/admin/admin.service.test.ts` — extend the existing
  `upsertUser` regression block (~483-558) and `attachProductToGroup` block
  (~1321-1414) with the race-handling cases below.
- `apps/api/src/modules/admin/admin.integration.test.ts` — add the
  concurrency-shaped integration test for `attachProductToGroup`.

## Verification

- `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- `cd apps/api && pnpm test:integration` — required: this is a
  unique-constraint race fix, must be proven against the real DB.
- Concurrency-shaped test (two racing calls): fire two concurrent
  `attachProductToGroup` calls for the same `groupId`/`productId` pair —
  assert exactly one persists the attach and the other resolves cleanly
  (existing row or `AdminGroupProductConflictError`), never a raw 500.
- Preservation test (explicit task): admin edits a user's email via
  `upsertUser` → assert `samlId` on the persisted row is byte-identical to
  its value before the edit (i.e. the update branch does not touch it).

## Sequencing

No ordering dependency on other P1 changes in this batch — does not share
files with `session-hydration-error-scoping`, `record-comment-save-coordination`,
`published-section-order-determinism`, or `group-scope-isolation-gaps`.
