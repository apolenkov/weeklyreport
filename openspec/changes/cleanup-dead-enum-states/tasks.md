# Tasks

## Decisions (human, per value)

- [ ] T1: `CarryOverStatus.failed` (+ `pending`) — implement the writing path OR
      remove from enum + Zod (`@customreport/shared`) + Prisma + mapper.
- [ ] T2: `ReminderRuleStatus.paused` — implement the pause transition (writer +
      admin control) OR remove the value (and the anticipatory index).
- [ ] T3: `PdfExportStatus.processing` — remove (redundant) OR wire a real
      in-flight state.

## Apply

- [ ] T4: For each "remove": drop the value from `prisma/schema.prisma`, the Zod
      enum in `@customreport/shared`, and the domain↔db mapper; prefer a fresh
      `migrate reset` per the MVP-phase config note rather than an alter migration.
- [ ] T5: For each "implement": add the writer + a test asserting the new value is
      persisted.

## Verification

- [ ] T6: `pnpm typecheck && pnpm test` green after changes.
- [ ] T7: `openspec validate cleanup-dead-enum-states --strict` passes.

## Notes

- Evidence: `/tmp/catalog-findings-backup/_gaps.md` §4 + `_gaps-round2.md`
  (PdfExportStatus.processing), code-verified this session.
