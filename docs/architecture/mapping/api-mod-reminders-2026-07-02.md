# Mapping — api-mod-reminders (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-reminders-2026-07-02.md` (8 files).
Grouping rule applied: Target Structure §"Grouping rules" + Target tree note (api section).

`reminders` is explicitly classified as **MODERATE** in the target tree
(`admin/ carry-over/ weekly-report/ archive/ reminders/ # MODERATE — flat + explicit port
where a repo exists`) — not one of the three INVARIANT-BEARING modules (period,
report-sections, review/publication) that get the full `domain/application/infrastructure`
split. Per determinism knob 2, a module only grows internal-split subfolders once it bears
a load-bearing invariant; reminders bears none (fire-and-forget notifications, not one of
the Load-Bearing Invariants in root CLAUDE.md). It stays **flat at `modules/reminders/`**
even though it has 8 files (the invariant test governs, not the file-count trigger alone,
per the tree's explicit categorization) — it already has an explicit port
(`RemindersRepository` in `reminders.service.ts`, adapter in `reminders.prisma-repository.ts`),
satisfying "flat + explicit port where a repo exists" as-is.

| Current path                                                    | Target path                                                     | Layer                       | Domain    | Move? | Note                                                                                                                                                                                                             |
| --------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------- | --------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/api/src/modules/reminders/policy-applicator.service.ts     | apps/api/src/modules/reminders/policy-applicator.service.ts     | service (flat)              | reminders | no    | Moderate tier stays flat; already at canonical module root.                                                                                                                                                      |
| apps/api/src/modules/reminders/reminders-escalation-grouping.ts | apps/api/src/modules/reminders/reminders-escalation-grouping.ts | util/pure (flat)            | reminders | no    | Pure function module; would be `domain/` only if module were invariant-bearing — it isn't.                                                                                                                       |
| apps/api/src/modules/reminders/reminders-row-mappers.ts         | apps/api/src/modules/reminders/reminders-row-mappers.ts         | mapper (flat)               | reminders | no    | Prisma-row↔domain mapper; stays alongside the repository it serves.                                                                                                                                             |
| apps/api/src/modules/reminders/reminders.module.ts              | apps/api/src/modules/reminders/reminders.module.ts              | module-wiring               | reminders | no    | Module root file, binds port→adapter; canonical location already.                                                                                                                                                |
| apps/api/src/modules/reminders/reminders.prisma-repository.ts   | apps/api/src/modules/reminders/reminders.prisma-repository.ts   | repository (adapter, flat)  | reminders | no    | Existing explicit port's Prisma adapter; would move to `infrastructure/` only under a full split.                                                                                                                |
| apps/api/src/modules/reminders/reminders.router.ts              | apps/api/src/modules/reminders/reminders.router.ts              | router (interface)          | reminders | no    | Thin tRPC-style router; stays at module root under the flat/moderate shape.                                                                                                                                      |
| apps/api/src/modules/reminders/reminders.scheduler.ts           | apps/api/src/modules/reminders/reminders.scheduler.ts           | scheduler (adapter, flat)   | reminders | no    | Cron dispatcher; fire-and-forget notification, not an atomic cross-context write — stays flat per "events only for fire-and-forget (reminders, telemetry, search reindex)" (Considered & rejected, api section). |
| apps/api/src/modules/reminders/reminders.service.ts             | apps/api/src/modules/reminders/reminders.service.ts             | service (application, flat) | reminders | no    | Core service owning the `RemindersRepository` port; already satisfies "flat + explicit port."                                                                                                                    |

## Summary

- Files: 8
- Rows with Current != Target: **0**
- All 8 files already sit at their target path. `reminders` needs no directory
  reshaping — it already matches the target tree's "MODERATE: flat + explicit port"
  shape. No OpenSpec migration slice is warranted for this module.
