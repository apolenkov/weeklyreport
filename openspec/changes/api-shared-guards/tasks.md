# Tasks: api-shared-guards

## 1. Shared unique-violation guard

- [ ] 1.1 Add a shared api module exporting `PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE`
      (`"P2002"`) and `isUniqueViolation(error, scope?)`, where `scope` names an
      index and/or column set.
- [ ] 1.2 Implement identity matching by scanning serialized `meta` (non-throwing
      JSON) + the top-level `message`, never `meta.target` alone; return `true`
      only for a scope match when a scope is given, else for any P2002.
- [ ] 1.3 Add unit tests: pg-adapter-shaped error with unset `meta.target` → true;
      unrelated-constraint P2002 under a scope → false; non-P2002 → false.

## 2. Real-database matcher proof

- [ ] 2.1 Extend the existing `period/period-uniqueness.integration.test.ts` (it
      already provokes a genuine P2002 through the pg adapter and asserts
      `isOpenBoundaryConflict`) rather than adding a fresh file: add an assertion
      that the shared `isUniqueViolation` returns `true` for the same caught live
      error. A separate file would only duplicate the `_test` scaffolding.
- [ ] 2.2 In that same test, assert the caught live error's `meta.target` is
      unset — pinning why a `meta.target`-only guard misses under the adapter, so
      a regression to `meta.target`-only matching fails the gate.

## 3. Consolidate the ad-hoc P2002 detectors

- [ ] 3.1 Replace `period-factory.isOpenBoundaryConflict`'s body with a scoped
      `isUniqueViolation` call (`Report_one_open_per_boundary` / periodStart+periodEnd),
      keeping its exported name and callers.
- [ ] 3.2 Replace `ensure-lead-section.isSectionUniqueViolation` with a scoped call;
      confirm the concurrent first-login race now resolves under the adapter.
- [ ] 3.3 Replace `user-session.isUserUniqueViolation` with a scoped call
      (email / samlId).
- [ ] 3.4 Replace the plain `error.code === "P2002"` checks in
      `lead-form.prisma-repository` (~375, ~415) and
      `report-sections.prisma-repository` (~1042) with unscoped calls.
- [ ] 3.5 Verify the admin / scheduler / period-repository callers keep routing
      through the rewired `isOpenBoundaryConflict` (`admin-period-lifecycle.ts`,
      `period-creator.scheduler.ts`, `period.prisma-repository.ts` already import
      and call it). No per-site scope re-declaration — 3.1 rewiring its body
      covers them, so re-inlining a scoped call at each site would re-create the
      duplication this change removes.
- [ ] 3.6 Fold reminders' `isDedupeKeyConflict` (`reminders-row-mappers.ts`) onto
      the guard SCOPED to `dedupeKey`, keeping its exported name and its
      `reminders.prisma-repository` caller. Behavior-preserving: it already
      matches the pg-adapter shape, this only removes the third copy.
- [ ] 3.7 Fold the two bare `code === "P2002"` swallow-sites onto the UNSCOPED
      guard: `carry-over.prisma-repository` (~227) and reminders'
      `policy-applicator.service` (~158). They check the code only today, so an
      unscoped call preserves their swallow-any-P2002 behavior — do NOT scope
      them, or an unrelated P2002 would newly re-throw.
- [ ] 3.8 Grep the api tree to confirm NO non-test `"P2002"` literal remains
      anywhere (all nine sites now route through the shared guard/constant).

## 4. Shared publish compare-and-set helper

- [ ] 4.1 Add a shared helper owning the canonical predicate
      `{ id, periodStatus: { not: "published" }, archived: false }` and the
      `count === 0` → `{ transitioned | raced | archived }` classification, with
      the Prisma client injected.
- [ ] 4.2 Adopt it in `PeriodPrismaRepository.publishPeriod`, passing the
      transaction client; keep the snapshot built from the written-back row inside
      the `$transaction`.
- [ ] 4.3 Adopt it in `PublicationPrismaRepository.publishAssembledReport`,
      passing the base client and a `data` field set that INCLUDES its
      `publishedSnapshot` (built from the in-memory assembled report) so the
      snapshot rides inside the single guarded `updateMany` — with no surrounding
      transaction, single-statement execution is its only atomicity.
- [ ] 4.4 Confirm `saveAutoPublishedReport` (`status: "draft"` predicate) is left
      untouched and does not call the manual-publish helper.

## 5. Verify

- [ ] 5.1 Run the full api unit suite, then the integration gate via
      `pnpm test:integration` (single-threaded — bare parallel vitest stomps the
      shared `_test` DB and mass-fails on FKs) with docker postgres+redis up;
      `period.publish-atomicity.integration.test.ts` and the extended
      `period-uniqueness.integration.test.ts` must pass unchanged.
- [ ] 5.2 Run typecheck + lint clean (`--max-warnings 0`) with no new
      `eslint.config.ts` exemption for the shared modules.
