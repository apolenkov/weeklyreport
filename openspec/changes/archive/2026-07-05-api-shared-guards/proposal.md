# Proposal: api-shared-guards

## Why

Two pieces of hard-won Prisma concurrency knowledge live inline in `apps/api`,
copy-pasted across many call sites, with no single home:

1. **Unique-violation (P2002) detection** is re-implemented ad-hoc at nine
   non-test sites. Two of those copies (`ensure-lead-section`, `user-session`)
   check `meta.target` ONLY — but under the pg driver adapter this app runs, a
   real P2002 leaves `meta.target` UNSET, so those guards return `false` and the
   concurrent-login race they are meant to absorb re-throws as a raw 500. The
   correct pg-adapter shape already exists in TWO independent copies —
   period-factory's `isOpenBoundaryConflict` (verified against the `_test` DB)
   and reminders' `isDedupeKeyConflict` (a third full re-implementation of the
   same serialized-`meta` + `originalMessage` scan) — plus four bare
   `error.code === "P2002"` checks. Nothing is shared; the "no single home"
   premise holds even though `isDedupeKeyConflict` already gets the shape right.

2. **The publish compare-and-set** (guarded `updateMany` predicate +
   zero-row disambiguation into raced/archived) is implemented twice —
   `PeriodPrismaRepository.publishPeriod` and
   `PublicationPrismaRepository.publishAssembledReport`
   carry the identical canonical predicate and the identical `count === 0`
   classification, drifting independently.

This change homes both as shared, tested modules. It is a planning artifact only;
no product/src code is edited here.

## What Changes

- Introduce a shared unique-violation guard: a single
  `PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE` constant and an `isUniqueViolation`
  predicate that matches the pg-adapter error shape (serialized `meta` +
  top-level `message`, NOT `meta.target` alone) and can be scoped to a named
  index / column pair so an unrelated P2002 still re-throws.
- Consolidate ALL nine ad-hoc P2002 detectors onto it, so no bare `"P2002"`
  literal remains in non-test code: `ensure-lead-section`, `user-session`,
  `period-factory.isOpenBoundaryConflict`, `reminders.isDedupeKeyConflict`,
  `lead-form.prisma-repository`, `report-sections.prisma-repository`,
  `carry-over.prisma-repository`, `reminders.policy-applicator.service`, and the
  admin period writers. Adoption is behavior-preserving everywhere EXCEPT the two
  `meta.target`-only sites, whose adoption also fixes a latent race-masking bug.
  `isDedupeKeyConflict` folds onto the guard scoped to `dedupeKey`; the two bare
  `error.code === "P2002"` swallow-sites (`carry-over`, `policy-applicator`) fold
  onto the UNSCOPED guard — they check the code only today, so an unscoped call
  preserves their current swallow-any-P2002 behavior.
- Mandate a real-DB integration test that provokes an actual P2002 through the
  pg adapter and asserts the guard fires when `meta.target` is unset.
- Introduce ONE guarded compare-and-set helper both publish repositories call:
  it owns the canonical predicate `{ id, periodStatus: { not: "published" },
archived: false }` and the `count === 0` → `{ transitioned | raced | archived }`
  classification. The client (transaction or base) is injected so each caller
  keeps its own transaction context and its own snapshot-write strategy — a
  behavior-preserving dedup, no write-path semantics change.

## Capabilities

### New Capabilities

- `prisma-unique-violation-guard` — the shared P2002 constant + `isUniqueViolation`
  contract, its pg-adapter matching rule, and the mandated real-DB test.
- `publish-compare-and-set` — the single shared publish CAS predicate + zero-row
  disambiguation contract both repositories consume.

### Modified Capabilities

- None. Both concerns are new shared contracts; `period-dual-state` (single
  transition writer, atomic dual-state) is an unchanged constraint the CAS
  helper must continue to honour, not a spec being edited.

## Impact

- **Guard adoption sites** (part 1):
  - `apps/api/src/modules/report-sections/ensure-lead-section.ts`
    (`isSectionUniqueViolation`, `meta.target`-only → latent bug fixed)
  - `apps/api/src/modules/auth/user-session.ts`
    (`isUserUniqueViolation`, `meta.target`-only → latent bug fixed)
  - `apps/api/src/modules/period/period-factory.ts`
    (`isOpenBoundaryConflict` — one of two correct reference shapes, folded in
    via an index/column scope rather than left as a separate copy)
  - `apps/api/src/modules/reminders/reminders-row-mappers.ts`
    (`isDedupeKeyConflict` — the third full copy of the pg-adapter shape; already
    correct, folded onto the guard scoped to `dedupeKey`)
  - `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts` (~375, ~415)
  - `apps/api/src/modules/report-sections/report-sections.prisma-repository.ts` (~1042)
  - `apps/api/src/modules/carry-over/carry-over.prisma-repository.ts` (~227,
    bare `code === "P2002"` → UNSCOPED call, swallow-behavior preserved)
  - `apps/api/src/modules/reminders/policy-applicator.service.ts` (~158,
    bare `code === "P2002"` → UNSCOPED call, swallow-behavior preserved)
  - the admin period writers translating the open-boundary P2002 (already route
    through `isOpenBoundaryConflict`, so rewiring 3.1 covers them — no per-site edit)
- **CAS adoption sites** (part 2):
  - `apps/api/src/modules/period/period.prisma-repository.ts` (`publishPeriod`)
  - `apps/api/src/modules/publication/publication.prisma-repository.ts` (`publish`)
  - OUT of scope: `PublicationPrismaRepository.saveAutoPublishedReport` — a
    DIFFERENT CAS (predicate `status: "draft"`), not this dedup.
- **Tests**: new real-DB integration test for the guard; the existing
  `period.publish-atomicity.integration.test.ts` continues to gate the CAS.
- No schema, API contract, or dependency changes.
