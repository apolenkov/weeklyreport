# Design: api-shared-guards

## Context

Two Prisma concurrency idioms are duplicated across `apps/api`:

- **P2002 detection.** The reference implementation is
  `period-factory.isOpenBoundaryConflict`, which was verified against the real
  `_test` DB and documents the ground truth: under the pg driver adapter this
  app runs, a genuine P2002 leaves `meta.target` UNSET — the constraint identity
  surfaces in `meta.driverAdapterError.cause.originalMessage`, `cause.constraint.fields`,
  and the top-level `message`. Two other detectors —
  `ensure-lead-section.isSectionUniqueViolation` and
  `user-session.isUserUniqueViolation` — build their identity string from
  `meta.target` ONLY. Under the adapter that string is empty, so both return
  `false` and re-throw the very race they exist to absorb. A SECOND correct copy
  of the same serialized-`meta` + `originalMessage` scan lives independently in
  reminders' `isDedupeKeyConflict` (scoped to `dedupeKey`) — so the shape is
  right in two places and wrong in two, with no shared home. Additional plain
  `error.code === "P2002"` checks live in `lead-form.prisma-repository`,
  `report-sections.prisma-repository`, `carry-over.prisma-repository`,
  reminders' `policy-applicator.service`, and the admin period writers — nine
  non-test detection sites in total.

- **Publish CAS.** `PeriodPrismaRepository.publishPeriod` and
  `PublicationPrismaRepository.publishAssembledReport` each carry the identical guarded
  predicate `{ id, periodStatus: { not: "published" }, archived: false }` plus
  the identical `count === 0` → raced/archived re-read. They differ only in
  execution context (period repo inside `$transaction`, publication repo not)
  and in where the snapshot comes from (written-back row vs in-memory assembled
  report).

This is a planning change: it defines the shared contracts; no code is edited here.

## Goals / Non-Goals

**Goals**

- One `PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE` constant + one `isUniqueViolation`
  guard with pg-adapter-correct matching and an optional index/column scope.
- One publish CAS helper both repositories call, behavior-preserving.
- A real-DB integration test that proves the guard fires when `meta.target` is
  unset.

**Non-Goals**

- No change to publish semantics, the period-dual-state single-transition-writer
  invariant, or the lifecycle field set.
- No unification of snapshot writing between the two publish callers.
- `saveAutoPublishedReport` (predicate `status: "draft"`) is not folded in.
- No new dependencies, schema, or API contract changes.

## Decisions

### D1: Guard identity derives from serialized meta + message, never meta.target alone

Match `isOpenBoundaryConflict`'s proven shape: serialize `meta` (via a
non-throwing JSON helper) and concatenate the top-level `message`, then test the
combined string for the index name or the column pair. This is the only shape
that survives the adapter.

_Alternative considered:_ read `meta.driverAdapterError.cause.constraint.fields`
structurally. Rejected — the nested path is adapter-internal and more brittle
than a string scan across both meta and message, which also covers the
classic-engine `meta.target` form as a backstop.

### D2: The guard takes an optional scope; unscoped means any-P2002

Signature shape: `isUniqueViolation(error, scope?)` where `scope` names an index
and/or a column set. Scoped callers (`user-session` → email/samlId,
`ensure-lead-section` → its section index, `isOpenBoundaryConflict` →
`Report_one_open_per_boundary`) get a `true` only for their own constraint and
re-throw an unrelated P2002 — preserving the safety property period-factory
already documents. Unscoped callers (`lead-form`, `report-sections` →
`DUPLICATE_CHILD_ROW`) accept any P2002.

_Alternative considered:_ separate per-constraint predicates. Rejected — that is
the duplication being removed.

### D3: The CAS helper owns predicate + disambiguation only; client is injected

The shared unit is the canonical predicate and the `count === 0` →
`{ transitioned | raced | archived }` classification. It receives the Prisma
client (transaction or base) as a parameter, AND the caller's full `data` field
set — the guarded `updateMany` writes exactly the `data` the caller hands it, so
one helper serves two callers with different field sets.

"Does NOT own snapshot writing" means the helper never BUILDS or SOURCES the
snapshot — it does NOT mean the snapshot becomes a separate statement. Each
caller composes its own `data` (lifecycle fields + its own `publishedSnapshot`)
and passes it in; the helper applies that `data` inside the SINGLE guarded
`updateMany`:

- `publishAssembledReport` runs with NO surrounding transaction, so
  single-statement execution is its ONLY atomicity: its `publishedSnapshot`
  (built from the in-memory assembled report) MUST ride inside the same guarded
  `updateMany` `data` — it cannot be a second write.
- `publishPeriod` runs inside a `$transaction`, so the transaction gives it
  atomicity; it builds its snapshot from the written-back row within that
  transaction.

The two callers stay distinct at the snapshot SOURCE (in-memory report vs
written-back row) while sharing the predicate + disambiguation core; neither
loses single-statement/transactional atomicity.

_Alternative considered:_ fully unify both methods into one, moving snapshot
assembly inside the helper. Rejected — the snapshot sources genuinely differ
(fresh DB row vs in-memory report), and unifying would change observable
behavior, violating the dedup-only mandate.

### D4: Both shared modules live in `apps/api/src/lib/`

The unique-violation guard and the publish CAS helper are cross-cutting api
utilities, so they go in `apps/api/src/lib/` — the existing home for exactly this
kind of module (`env.ts`, `logger.ts`, `business-date.ts`, `group-scope.ts`).
Concretely: `apps/api/src/lib/prisma-unique-violation.ts` and
`apps/api/src/lib/publish-compare-and-set.ts` (final basenames at the
implementer's discretion, but the directory is fixed).

_Ordering vs `restructure-directory-architecture`:_ that active change reshapes
`apps/api/src/modules/{period,report-sections,review,publication}/…` into
internal slices and dissolves the web `lib/mappers/`, but does NOT relocate
`apps/api/src/lib/` itself. Placing the two modules there therefore sits outside
its blast radius. If both changes are in flight, land the guards in `lib/` first;
restructure only rewires the `modules/*` call sites, which import from `lib/`
regardless of how the slices are renamed. No path collision either way.

## Risks / Trade-offs

- **A too-permissive unscoped guard masks an unrelated unique violation** →
  Mitigation: scoped callers must pass their scope; spec scenarios assert an
  unrelated P2002 returns `false` and re-throws.
- **A regression to `meta.target`-only matching would silently pass unit tests
  built on hand-mocked errors** → Mitigation: the mandated real-DB integration
  test provokes a live P2002 and asserts both `isUniqueViolation === true` and
  `meta.target` unset, so a regression fails.
- **The CAS extraction could subtly change the period repo's transactional
  atomicity** → Mitigation: `period.publish-atomicity.integration.test.ts` is
  the standing gate and must pass unchanged; the client is injected so the
  helper runs inside the caller's existing `$transaction`.

## Migration Plan

Not applicable — no data or schema migration. Implementation adopts the shared
modules site-by-site; each adoption is behavior-preserving except the two
`meta.target`-only guards, whose adoption is an intentional race-masking fix.

## Open Questions

None. The pg-adapter error shape is settled (verified in `isOpenBoundaryConflict`
against `_test`); the two CAS sites and the out-of-scope auto-publish CAS are
identified.
