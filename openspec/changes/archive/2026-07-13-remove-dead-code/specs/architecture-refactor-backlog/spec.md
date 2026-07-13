## ADDED Requirements

### Requirement: The 2026-07-12 dead-code inventory is a recorded, closed cleanup

The backlog MUST record that the dead and orphaned code surfaced by the
2026-07-12 repo-excellence review was removed by `remove-dead-code`: the
orphaned duplicate `apps/api/src/modules/reminders/reminders.router.ts`
(the scope-checked procedures inline in `trpc.router.ts` are the only
production reminder-execution surface), the two dead session validators in
`apps/web/src/server/auth/session.ts`, the dead `isoWeekLabel` helper and its
two supporting constants in `apps/web/src/features/admin/model/admin.ts`, the
always-false `blocked` check in `section-slide-utils.ts`'s
`crossAuthorContentToSlideForeign` (the shared `itemWorkflowStatusSchema`
union excludes `"blocked"`, so the comparison could never be true), and the
PDF-export `checksum` value that the service threaded through
`markExportCompleted` while the real Prisma repository silently dropped it —
now persisted on `PdfExportJob.checksum`. It MUST also record that the
reminder-policy backfill script's `computeFireAt` no longer takes a dead
`_tz` parameter: it now uses the same luxon zone-aware math as
`PolicyApplicatorService.computeFireAt`, and both functions' doc comments
were corrected to describe the math accurately (exact-duration minutes added
to a zoned instant, not calendar wall-clock preservation), with the
class-level doc's stale claim that the backfill script calls `applyToPeriod`
removed. The two `computeFireAt` implementations MUST stay separate
functions, cross-referencing each other by file path, because the prisma
toolchain's isolated `tsconfig.prisma.json` cannot resolve `apps/api` or
`packages/shared` imports — the same constraint already carved out for
`prisma/seed-constants.ts`.

#### Scenario: the dead-code cleanup is discoverable

- **WHEN** a maintainer searches for known dead-code cleanups
- **THEN** the backlog names the six removed/fixed surfaces (reminders
  router, session validators, `isoWeekLabel`, the always-false `blocked`
  check, the PDF-export checksum gap, and the backfill `computeFireAt` dead
  parameter) and records them as closed by `remove-dead-code`
- **AND** it states why the two `computeFireAt` implementations remain
  separate rather than sharing one imported helper

#### Scenario: a future prisma-script change needs logic from apps/api or packages/shared

- **WHEN** an agent or maintainer considers importing workspace code into a
  `prisma/*.ts` script
- **THEN** the backlog's carve-out (first established for
  `prisma/seed-constants.ts`, reaffirmed here for `computeFireAt`) applies:
  the isolated `tsconfig.prisma.json` cannot resolve those imports, so the
  logic is kept as an intentionally cross-referenced literal mirror instead
