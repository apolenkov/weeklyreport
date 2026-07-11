## Why

The report-section read-model mapper takes a hand-written intersection type
(`PrismaReportSectionWithRelations`) as input, fed by ten production call
sites via `as unknown as` (five direct, three through
`Parameters<typeof mapPrismaToReportSection>[0]`, one nested cast in
`published-report-snapshot.ts`, one `any[]` erasure in
`weekly-report.prisma-repository.ts`) — all ten queries build their row from
the exact same `reportSectionFullInclude` constant (or a superset of it).
The backlog names this as a deferred follow-up: "the cross-module
`as unknown as PrismaReportSectionWithRelations` infrastructure cast
coupling." Two-seat council grilling (deep-reasoning adviser + Codex, both
verifying independently, plus the orchestrator's own file-by-file
verification) confirmed: this is not three consumers with divergent query
shapes needing three types — it is one hand-maintained type that drifted
from what Prisma can already generate, kept alive so legacy unit fixtures
could omit fields via optional-marked relations. The drift hides two real
type lies (`projectStatuses[].status` claimed non-null `string`, the column
is `TrafficLightStatus | null`; item/risk/decision `.project` claimed
optional-but-present, the relation is genuinely nullable) that are currently
runtime-benign — `asTraffic`/optional-chaining already handle real nulls
correctly — and ONE reachable correctness bug: the post-save re-read in
`saveSection` casts a `findUnique` result (nullable by Prisma's own generated
signature) straight into the mapper with NO null guard, unlike every other
call site. A concurrent admin report-delete (cascades to `ReportSection`)
landing between the save transaction's commit and this outside-transaction
re-read throws an unhandled `TypeError` instead of a clean conflict error.

## What Changes

- `reportSectionFullInclude` gains `satisfies Prisma.ReportSectionInclude`;
  `PrismaReportSectionWithRelations` becomes
  `Prisma.ReportSectionGetPayload<{include: typeof reportSectionFullInclude}>`
  instead of a hand-written intersection. `mapPrismaToReportSection`'s
  parameter type follows.
- Remove all ten production casts: the two direct sites in
  `report-sections.prisma-repository.ts`, both `carry-over` sites, the
  `pdf-export` nested cast, the three `lead-form` sites (dropping two
  already-redundant extra narrowing casts on the same call while touched),
  the `published-report-snapshot.ts` cast (its own `SnapshotReportRow` /
  `SnapshotSectionRow` hand types are replaced by a `Prisma.ReportGetPayload`
  derivation so the function's declared input finally matches what every
  caller provides), and the `weekly-report.prisma-repository.ts` `any[]`
  escape hatch.
- Move the `saveSection` post-save re-read INSIDE the existing write
  transaction (closing the race at its source — Postgres serializes a
  concurrent cascade-delete against the open transaction's row locks, not
  just narrowing the window) and make it throw `SectionVersionConflictError`
  on the defensive not-found case instead of ever casting a possible `null`.
- Drop the mapper's fixture-tolerance guards that the generated (non-optional)
  array/relation fields make provably unreachable; keep every guard that
  defends a genuinely nullable Prisma column.
- Re-point the three affected unit-test fixture builders to the generated
  payload type; one fixture ("skips rows without a loaded project relation")
  changes its constructed value from `project: undefined` to the real
  contract's `project: null` — same assertion, honest input shape.

Non-goals:

- No query/include shape change — same relations, same fields, zero
  payload/API/UI delta on every normal-path read.
- No change to the six unrelated `as unknown as` seams (Prisma `$on` event
  overload, Passport Express 4/5 shim, four `prom-client` writable-`collect`
  adaptations) — different typing problem, out of scope.
- No new ESLint rule or lint-gate — Zone 4/4b already leave infrastructure
  adapters and `*.prisma-repository.ts` files alone; nothing to add.

## Capabilities

### New Capabilities

- `report-section-prisma-payload`: Defines the report-section mapper's input
  as a generated Prisma payload type (never a hand-written mirror), pins the
  concurrent-deletion hardening.

### Modified Capabilities

- `architecture-refactor-backlog`: Records the cross-module cast-coupling
  follow-up as closed with the corrected ten-site inventory.

## Impact

- `apps/api`: 6 source files (report-sections, carry-over, pdf-export,
  lead-form, published-report-snapshot, weekly-report infra), 4 test files.
  The report-sections barrel re-exports the type by reference — untouched,
  no edit needed. `archive.prisma-repository.ts` independently declares an
  identical `Prisma.ReportGetPayload` shape and was never one of the ten
  cast sites; verified unaffected, needs no change.
- No database migration, no wire/API payload change, no UI change on the
  normal path. Behavior hardening only on the narrow concurrent-deletion
  race (an unhandled crash becomes a clean `CONFLICT` the client already
  knows how to retry on).
- Gates: `pnpm --filter @customreport/api db:generate`, `pnpm typecheck`,
  `pnpm lint`, full `pnpm test`, `pnpm test:integration` (single-thread,
  shared DB), `pnpm format:check`, residual cast sweep, strict OpenSpec
  validation.
