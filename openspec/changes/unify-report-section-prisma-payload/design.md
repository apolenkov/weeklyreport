## Context

`apps/api/src/modules/report-sections/infrastructure/report-sections.prisma-repository.ts`
declares `reportSectionFullInclude` (the one shared Prisma `include` shape
every report-section read uses) and, beside it, a HAND-WRITTEN
`PrismaReportSectionWithRelations` interface meant to mirror what that
include produces. Ten production call sites cast a real query result into
this hand type via `as unknown as` (or an `any[]` erasure), because the hand
type is not structurally identical to what Prisma actually infers — it
marks several always-present relation arrays OPTIONAL (`activityStatuses?`,
`sectionReviews?`, item/risk/decision `.project?`, `project.stageAssignments?`)
so that legacy unit fixtures predating an include-widening could still
satisfy it, and it narrows two genuinely nullable DB columns to non-null
(`projectStatuses[].status: string` vs the real `TrafficLightStatus | null`
column; the item/risk/decision `.project` relation is nullable — an
activity-parented record has no product — not merely optional-when-absent).

Two-seat council grilling (deep-reasoning adviser + Codex, both verifying
independently against the actual queries, schema, and mapper code) plus the
orchestrator's own file-by-file re-verification (every cast site's query
include, every consuming field, the cascade-delete relation, the admin
delete call site) converged:

- All ten producers build their row from `reportSectionFullInclude` or a
  strict superset (lead-form's `getSectionForPeriod` adds sibling `report`/
  `reopenRequests` includes; pdf-export/snapshot nest it under
  `reportFullInclude.sections.include`). One shared shape, not three
  divergent ones — the "three consumers grew incompatible query shapes"
  hypothesis is false.
- `Prisma.ReportSectionGetPayload<{include: typeof reportSectionFullInclude}>`
  already exists in the generated client and is a _stronger_ type than the
  hand-written one (accurately nullable, no optional-array escape hatch).
  `pdf-export.prisma-repository.ts` already uses the sibling
  `Prisma.ReportGetPayload<{include: typeof reportFullInclude}>` for its
  outer `report` row — proof this pattern already works in this codebase.
- The two type lies are runtime-benign TODAY: `asTraffic()` already accepts
  `string | null | undefined` and returns `null` for anything not
  green/yellow/red; the mapper's project-name resolution already uses
  `project?.name` optional chaining. Nothing currently misreads a real null
  as a valid value.
- ONE real bug: `saveSection`'s post-save re-read
  (`report-sections.prisma-repository.ts:1046-1053`) is the only cast site
  with NO null guard before mapping — `getSectionById` guards with
  `if (!row) return null`, this site does not. Prisma's own generated
  `findUnique` signature is nullable; the cast erases that. `ReportSection`
  cascades from `Report` (`onDelete: Cascade`,
  `prisma/schema.prisma:281-283`), and the admin period-close/delete path
  (`admin-period.queries.ts:189-197` calling `prisma.report.delete`) can
  remove any non-published report. A delete landing in the window between
  the save transaction's commit and this outside-transaction re-read throws
  an unhandled `TypeError` reading `row.id` off `null`, instead of the
  `SectionVersionConflictError` → `CONFLICT` the client already retries on.

Load-bearing invariants:

- Zero query/include change: same `reportSectionFullInclude` constant,
  same fields fetched, same fields read. This is a type-position and
  transaction-boundary change only.
- The mapper's Zod parse (`reportSectionReadModelSchema.parse(...)`,
  `report-sections.prisma-repository.ts:511`) stays the actual runtime
  contract enforcement point — the generated payload type is a compile-time
  accuracy improvement, not a new validation layer.
- No behavior change on any currently-passing path; the ONLY observable
  difference is the concurrent-deletion race turning a 500 into a 409-style
  domain error the client already handles.

## Goals / Non-Goals

**Goals:**

- One generated-payload type backs `mapPrismaToReportSection`'s parameter;
  the hand-written mirror interface is deleted.
- Zero `as unknown as` (or `any[]`) between a report-section Prisma query and
  the mapper, in production code.
- The concurrent-deletion race is closed at its source (inside the
  transaction), not merely converted to a narrower window.
- Backlog closed with the corrected ten-site inventory.

**Non-Goals:**

- No include/query shape change, no new fields fetched or dropped.
- No change to the six unrelated `as unknown as` seams elsewhere in `apps/api`
  (Prisma `$on`, Passport shim, `prom-client` adaptations) — a different
  typing problem (third-party type gaps, not a hand-mirrored domain type).
- No new lint rule — the existing Zone 4/4b eslint zones already leave
  infrastructure adapters alone; nothing here needs gating.

## Decisions

### D1: Generated payload, not a narrower/split hand type

Rejected: splitting into per-consumer types (the "three divergent shapes"
hypothesis, verified false — one include, reused). Rejected: a runtime
assertion at the mapper boundary (the mapper already Zod-parses its OUTPUT;
a second schema over the INPUT would be a second thing that can drift from
the query, exactly the problem being fixed). Accepted: derive the type from
the include Prisma already has, so the query and the type can never diverge
again — a query change either updates the generated type for free or fails
to compile at every real call site.

### D2: Fixture-tolerance guards die where the new type makes them

unreachable, survive where a column is genuinely nullable

`late ?? false`, `project.stageAssignments ?? []`, `recordComments ?? []`
(items/risks/decisions), `activityStatuses ?? []`, `sectionReviews ?? []`
existed only because the hand type marked those relation arrays optional for
legacy-fixture tolerance — Prisma's generated payload for an `include`d
to-many relation is always a real (possibly empty) array, never
undefined. These guards become `no-unnecessary-condition` errors once the
type is honest and are removed. Guards over the genuinely nullable
scalars/relations (`projectStatuses[].status`, item/risk/decision
`.project`) stay — those really can be `null` at runtime and the mapper's
existing handling (`asTraffic`, `project?.name`) is already correct for
that, just now type-honest too.

### D3: Post-save re-read moves inside the transaction

Converting the cast site to `if (!saved) throw new
SectionVersionConflictError(...)` would only narrow the crash window, not
close it — the delete could still land in the gap. Reading the just-written
row with the SAME include INSIDE the still-open transaction is the
objectively stronger fix — and it works through a lock that ALREADY existed,
not a new one: the transaction's leading compare-and-set
(`tx.reportSection.updateMany`) already takes this ReportSection row's write
lock for the transaction's full duration. A concurrent report delete's
FK-cascade needs that same row lock to proceed, so it blocks until this
transaction commits. The actual fix is closing the post-commit GAP (an
independent, unlocked re-read after the lock was released) by reading inside
the lock's lifetime instead — not a new lock on the recreated child rows.
Adversarial verification confirmed the mechanism (no `isolationLevel`
override changes Postgres's default READ COMMITTED blocking behavior here)
but noted this claim rests on lock-semantics reasoning plus a mocked unit
test, not a live two-connection race test — accepted, since a reliable
concurrent-Postgres-connections test is expensive relative to the
well-established MVCC guarantee it would confirm. The defensive `if
(!saved)` stays as a genuine "this should be unreachable" guard (throws the
same conflict error), since the code should not silently assume the lock
holds without a fallback.

### D4: `published-report-snapshot.ts`'s own hand types get the same fix

`SnapshotReportRow`/`SnapshotSectionRow` are a SECOND instance of the same
pattern (an underspecified hand type papering over what's actually a full
Prisma payload) — `buildAssembledReportFromPrismaRow`'s declared parameter
type has only `id` + `projectStatuses` when every real caller
(`period.prisma-repository.ts`, `publication.prisma-repository.ts`,
`archive.prisma-repository.ts`) fetches the full
`reportFullIncludeForSnapshot` graph. Deriving it from
`Prisma.ReportGetPayload<{include: typeof reportFullIncludeForSnapshot}>`
makes the function's signature honestly describe what it receives and
removes the nested cast in the same move.

### D5: `weekly-report.prisma-repository.ts`'s `any[]` escape is the same

coupling by a different spelling

`(report.sections as any[]).map(mapPrismaToReportSection)` exists for the
same reason as the other nine casts (the hand type didn't match); its own
query already uses `reportSectionFullInclude` verbatim. Once the mapper's
parameter type is the generated payload, `report.sections` is already
directly assignable — delete the `any[]` cast and its `eslint-disable`
comment together.

## Risks / Trade-offs

- The mapper's Zod-parse step (`reportSectionReadModelSchema.parse`) is the
  real safety net either way — this change improves the TYPE-CHECK-TIME
  contract, not runtime validation, so a regression here would surface as a
  parse failure or a `no-unnecessary-condition` lint error, not a silent
  behavior change.
- Test-fixture churn — three files change their cast target and one fixture
  changes `project: undefined` to `project: null` (same assertion, honest
  shape) — called out for review; no assertion's expected value changes.
- The transaction-boundary change (D3) is the one piece with a genuine (if
  narrow, previously-unreachable-by-crash) behavior difference: a
  concurrent delete during save now surfaces as `SectionVersionConflictError`
  instead of crashing. Covered by a new regression test and the full
  integration suite (shared-DB, single-thread) since it changes
  transaction shape.

## Migration Plan

1. `report-sections.prisma-repository.ts`: retype `reportSectionFullInclude`
   (`satisfies`), replace `PrismaReportSectionWithRelations` with the
   generated payload, drop the two production casts, remove the
   now-unreachable optional guards, move the post-save re-read inside the
   transaction with the defensive throw.
2. `carry-over.prisma-repository.ts`, `pdf-export.prisma-repository.ts`:
   drop their casts and the now-unused type import.
3. `lead-form.prisma-repository.ts`: drop the three
   `Parameters<typeof mapPrismaToReportSection>[0]` casts and the two
   redundant `report`/`reopenRequests` narrowing casts on the same call.
4. `published-report-snapshot.ts`: derive `SnapshotReportRow` from the
   generated payload; drop its cast.
5. `weekly-report.prisma-repository.ts`: drop the `any[]` escape.
6. Test files: re-point the three fixture builders; fix the one
   `undefined`→`null` fixture; add the concurrent-deletion regression test.
7. Gate: db:generate, typecheck, lint (`--max-warnings 0`), full unit suite,
   `pnpm test:integration` (single-thread), format:check, residual `as
unknown as PrismaReportSectionWithRelations` sweep (must return zero
   production hits), OpenSpec strict validation.

Rollback is a normal git revert; no persisted data or API surface changes.

## Open Questions

- None blocking.
