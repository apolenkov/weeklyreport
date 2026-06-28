## Context

Carry-over moves each lead's unfinished next-week items and unresolved decisions
from the closing period's report into the freshly opened period's report. The
service layer (`carry-over.service.ts`) already computes the correct rows for
every lead section, but the persistence layer
(`carry-over.prisma-repository.ts`) loses or corrupts most of that work.

Current write flow (`saveCarryOver`):

1. Service builds `nextTargetSections` for ALL target sections.
2. Service passes only `nextTargetSections.at(0)` — the FIRST section — to
   `saveCarryOver(execution, records, targetSection)`.
3. Repository upserts that one section's carried items via `Item.createMany`,
   omitting `priorityRank` and `stageNames`.
4. Repository upserts that one section's carried decisions via
   `Decision.createMany`, writing `stageName: d.stageIds?.join(", ")` — a field
   that does not exist on the `Decision` model (`schema.prisma:351` is
   `stageNames String[]`). Prisma rejects the unknown field and aborts the whole
   `$transaction` whenever a carried decision with a product is present.
5. Execution insert is `findFirst`-then-`create` with no guard on the unique
   `dedupeKey`, so a concurrent second run throws a raw P2002.

The single integration test seeds empty decisions and one section, so steps 2–5
never bite in CI.

## Goals / Non-Goals

**Goals:**

- Persist carried items and decisions for every target section.
- Use the real `stageNames` array column for decisions and items; delete the
  bad `stageName` reference.
- Carry `priorityRank` and `stageNames` onto created items.
- Make the dedupe write race safe (no unhandled P2002 / 500).
- Add integration coverage that exercises each fixed path.

**Non-Goals:**

- No Prisma schema change — all target columns already exist.
- No new `CarryOverStatus` values; do not resurrect `failed`/`pending`
  (enum-state-hygiene dispositioned them: the service writes only `completed`).
- No change to the matching rule (carried rows are matched to target sections by
  `authorId`); only persistence breadth and fidelity change.
- No change to tRPC procedure shape or the carry-over router contract.

## Decisions

### D1: Persist all target sections

Change the repository to write every target section rather than the first.
Preferred shape: pass the full `nextTargetSections` array to `saveCarryOver`
(rename the third parameter, e.g. `targetSections: ReportSectionReadModel[]`)
and loop the item/decision upserts per section inside the existing
`$transaction`. The `CarryOverResult.targetSection` return stays the first
section for back-compat with current callers, or widens to `targetSections`.

Alternative considered: keep the single-section signature and have the service
call `saveCarryOver` once per section. Rejected — that splits one execution
across N transactions, reintroducing the partial-failure window the single
transaction exists to prevent, and would create the execution row N times.

Before → after data flow:

- Before: service → `saveCarryOver(exec, records, sections[0])` → 1 section
  written; counts reflect N sections (orphan/mismatch).
- After: service → `saveCarryOver(exec, records, sections)` → N sections written
  in one transaction; counts match persisted rows.

### D2: Write `stageNames` array, drop `stageName`

Mirror `report-sections.prisma-repository.ts:597`: `stageNames: d.stageIds ?? []`
for carried decisions, and `stageNames: i.stageIds ?? []` for carried items.
Removing the unknown-field reference is what stops the transaction abort on
unresolved decisions.

### D3: Carry `priorityRank` + `stageNames` on items

Add `priorityRank: i.priorityRank ?? null` and `stageNames: i.stageIds ?? []`
to the `Item.createMany` payload, matching the lead-form save mapping so a
carried item is indistinguishable from a hand-entered one in those columns.

### D4: Handle the dedupe P2002 race

Wrap the execution insert and catch `Prisma.PrismaClientKnownRequestError` with
`code === "P2002"`, following the established reopen-request translation in
`lead-form.prisma-repository.ts:305`. On conflict, re-read the existing
execution by `dedupeKey` and return it (idempotent success), or throw a
`CarryOverDomainError` mapped to a conflict by the tRPC error mapper. Either way
the status stays `completed`; no `failed` row is written.

Alternative considered: `upsert` on `dedupeKey` / `createMany` with
`skipDuplicates`. Workable for the execution row, but a bare upsert would still
need a re-read to return the winning execution and its records, so the
catch-and-reread path is clearer and matches the repo's existing pattern.

## Risks / Trade-offs

- [Widening the `saveCarryOver` signature touches the service and any test
  doubles] → the only callers are `carry-over.service.ts` and the unit/contract
  tests; update them in the same change and keep the interface in the service
  file per repo convention.
- [Looping per-section writes increases statements inside one transaction] →
  bounded by the number of leads (≈6); well within the existing 15 s timeout.
- [Idempotent-vs-conflict choice for the P2002 race changes caller-visible
  behavior] → default to idempotent return of the existing execution so a retry
  is a no-op; only fall back to a domain conflict if the existing execution
  cannot be re-read.

## Migration Plan

No data migration. Pure code fix against existing columns. Deploy is a normal
API release. Rollback is reverting the code; no destructive operation and no
schema change, so the destructive-db guard is not engaged. Invariants preserved:
period dual-state (carry-over writes only child rows, never a Report period —
period-dual-state spec), role-coverage gate (router/procedure unchanged),
enum-state-hygiene (`completed`-only writes).

## Open Questions

- Should the dedupe race resolve to idempotent success or a surfaced conflict?
  Leaning idempotent (return existing execution); confirm against the head-side
  UX before implementing the error-mapper branch.
