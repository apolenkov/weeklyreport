## Context

Lead Chat first selects the canonical current live report and recent immutable published snapshots, then applies Lead authorization and projects candidates. This ordering is deliberately fail-closed. The local middle-tier database exposed two fixture defects at that boundary: newer scheduled-preview rows still carry the legacy `periodStatus = open` tuple but contain no sections, and published rows either have a hand-written snapshot with `sections: []` or no snapshot at all. A forced retrieval of the populated Week 30 live report produced 66 authorized candidates, proving that planning, filtering, ACL projection, and semantic infrastructure are not the failing components.

The defect spans Prisma seed entry points and the API-owned snapshot assembler. Supported seed commands currently write relational content and snapshots inconsistently. The correction must preserve snapshot authority, period dual-state, destructive safeguards, and the assistant's existing source-selection/ACL behavior.

### Before

```text
seed report rows -> write empty/null publishedSnapshot -> write section rows
                 -> write section-less scheduled preview rows

Lead Chat -> canonical source selection -> empty current/snapshot occurrence
          -> ACL/candidate projection -> no_results
```

### After

```text
seed report + section rows -> validate live fixture coverage
                           -> canonical API snapshot materializer
                           -> validate assistant-ready sources

Lead Chat -> unchanged canonical source selection -> populated live/snapshots
          -> unchanged ACL/candidate projection -> grounded result
```

## Goals / Non-Goals

**Goals:**

- Make the canonical, small, middle, and huge supported seeds produce assistant-searchable current content and truthful immutable published history.
- Keep scheduled preview periods useful if an old local database advances into their dates by giving the primary Lead valid searchable section content rather than relying on fallback selection.
- Build seeded snapshots with the same include, mapper, schema validation, ordering, and serializer used by publication.
- Fail the seed command if its final database state cannot produce authorized candidates for the canonical Lead or advertises published history without populated snapshots.
- Give developers a destructive-guarded reseed recovery path for already-broken non-production databases.

**Non-Goals:**

- Change SearchPlan, prompts, model configuration, embeddings, thresholds, or vector schema.
- Change the definition/order of canonical current and published sources.
- Fall back to older mutable live content when authorization or snapshot parsing yields no candidates.
- Backfill or reset production data.
- Add a new application endpoint or UI state.

## Decisions

### 1. Correct fixture production, not retrieval semantics

`selectPeriodSources`, authorization, and `no_results` remain fail-closed. Seeded future/scheduled report rows that may later become canonical under the existing clock-based rule MUST contain a primary-Lead section with at least one valid projected candidate. Published reports advertised by a demo tier MUST contain frozen sections.

Alternative rejected: select the newest report accessible to the caller after ACL. That silently changes “current report” into “newest report with data”, can answer from a stale week, and masks lifecycle/data defects.

### 2. Materialize snapshots only after relational seed content exists

All seed entry points use two phases: write deterministic relational rows first, then freeze each seeded published report. Remove hand-authored empty snapshot objects and deliberate `DbNull` placeholders from assistant-facing published fixtures.

The snapshot phase MUST call an API-owned non-production finalizer that reuses `reportFullIncludeForSnapshot`, `buildAssembledReportFromPrismaRow`, and `toPublishedSnapshotJson`. The finalizer runs through the supported root seed commands, Prisma seed command, dev reseed procedure, and CI/E2E setup paths. It MUST fail non-zero on parse, mapping, or write failure. Direct duplication of the assembled-report JSON shape in Prisma scripts is prohibited.

Alternative rejected: copy the snapshot JSON structure into each seed. That already produced the empty-snapshot bug and would drift from status derivation, activity fields, section ordering, and future schema changes.

### 3. Treat preview periods as future current fixtures

Demo tiers may retain scheduled/future periods for admin demonstrations, but every such period MUST be safe if the wall clock later makes it eligible under current lifecycle resolution. The seed reuses deterministic fixture builders to create at least the primary Lead's section and searchable report records/statuses for those rows. It does not clone IDs across periods; period-scoped deterministic ID ranges remain collision-free.

Alternative rejected: remove preview periods. That would regress the existing period-management demo. Merely documenting frequent reseeds is insufficient because the resulting failure looks like an assistant defect and can recur silently.

### 4. Verify the real boundary, not only isolated fakes

Extend seed coverage with database assertions and a focused PostgreSQL test that runs a supported seed, resolves default current-plus-three sources using a controlled clock, applies the real repository and authorization path for the canonical Lead, and projects candidates. Assertions cover both the immediate seed week and a clock advanced into the latest seeded preview period. Published assertions parse snapshots and prove their sections/candidates are non-empty.

Provider calls are replaced by existing deterministic planner/answer fakes; the test MUST NOT contact Mistral or require embeddings for exact/count smoke queries.

### 5. Preserve project invariants and operational boundaries

- **Period dual-state:** preserved. Seeded reports continue to write the complete canonical/legacy lifecycle tuple atomically; no selector fallback is introduced.
- **Role-coverage gate:** unaffected; no tRPC middleware chain changes.
- **Destructive DB guard:** preserved. Recovery reseeds run only through existing non-production guards. Production receives no reset or content rewrite.
- **Deferred-feature pattern:** unaffected.
- **Schema/migrations:** unchanged; this is data preparation and verification only.

## Risks / Trade-offs

- **[Snapshot finalization adds a second seed phase]** → Make the supported seed command fail as one operation when finalization fails, print the affected report ID, and keep reset/reseed as the documented non-production recovery.
- **[Published screens may expose fixture inconsistencies previously hidden by live fallback]** → Exercise published report rendering and assistant retrieval from the same frozen snapshot in integration/E2E coverage.
- **[Additional future-period rows increase demo volume]** → Reuse minimal deterministic content sufficient for one authorized candidate; preserve tier size intent and existing showcased records.
- **[A direct raw seed script could bypass finalization]** → Route Prisma config, package scripts, dev reseed, CI, and E2E through one supported orchestrator and document raw scripts as internal implementation details.
- **[Snapshot generation may enqueue embeddings]** → The finalizer only freezes canonical report JSON; it MUST NOT invoke publication side effects, notifications, audit events, or external AI. Semantic indexing remains handled by its existing ingestion path.

## Migration Plan

1. Add the API-owned non-production snapshot finalizer and its focused tests.
2. Restructure supported seed orchestration to run relational seeding, snapshot finalization, and readiness assertions in order.
3. Populate searchable content for scheduled preview periods in applicable demo tiers.
4. Update Prisma config, package commands, dev reseed, CI, and E2E setup to use the supported orchestration path.
5. Run a destructive-guarded reseed locally and in disposable UAT; verify exact/count Lead Chat questions over current and published periods without real provider calls in automated tests.
6. Run the normal project gates and a source-boot manual smoke with the configured provider.

Rollback is code-only for production because no production data/schema changes are deployed. In non-production, revert the change and reseed. Existing defective local databases are not repaired in place; they are reset and reseeded. Production snapshots, report rows, and migrations MUST NOT be altered by this plan.

## Open Questions

None. The implementation may choose filenames for the seed orchestrator/finalizer that best match current project organization, but the ownership and behavior above are fixed.
