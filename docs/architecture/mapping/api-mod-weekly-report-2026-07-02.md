# Mapping — api-mod-weekly-report (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-weekly-report-2026-07-02.md` (5 files).
Target-structure ref: `docs/architecture/TARGET-STRUCTURE-2026-07-02.md`.

`weekly-report` is classified **MODERATE** in the target tree (`admin/ carry-over/
weekly-report/ archive/ reminders/ — MODERATE — flat + explicit port where a repo
exists`), not INVARIANT-bearing (only period/report-sections/review/publication get
the full `domain/application/infrastructure` split per Grouping-rule knob 2: "a
module stays flat until it either bears a load-bearing invariant or exceeds ~6
files"). This module has 5 files and no load-bearing invariant of its own (it reads
period/report-sections/published-snapshot state, it doesn't own a dual-state write) —
so it stays **flat** at its current location. No files move.

| Current path                                                          | Target path                                                           | Layer                      | Domain        | Move? | Note                                                                                                                                                                                           |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------- | ------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/api/src/modules/weekly-report/cross-group-signal.ts              | apps/api/src/modules/weekly-report/cross-group-signal.ts              | util (flat)                | weekly-report | no    | Pure-ish util; module stays flat (5 files, no invariant) — no `domain/` split warranted per knob 2.                                                                                            |
| apps/api/src/modules/weekly-report/weekly-report-portfolio.ts         | apps/api/src/modules/weekly-report/weekly-report-portfolio.ts         | util (flat)                | weekly-report | no    | Same — stays at module root, not promoted to `domain/`.                                                                                                                                        |
| apps/api/src/modules/weekly-report/weekly-report.module.ts            | apps/api/src/modules/weekly-report/weekly-report.module.ts            | module-wiring              | weekly-report | no    | Module wiring stays at module root regardless of split status.                                                                                                                                 |
| apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts | apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts | repository (flat)          | weekly-report | no    | Adapter; would move to `infrastructure/` only if this module were promoted to full hexagon split — it isn't (grouping rule: gate the split on real branching logic/invariant, not size alone). |
| apps/api/src/modules/weekly-report/weekly-report.service.ts           | apps/api/src/modules/weekly-report/weekly-report.service.ts           | service (flat) + owns port | weekly-report | no    | Owns the `WeeklyReportRepository` port (explicit port, per "flat + explicit port where a repo exists"); stays at module root — no `application/` promotion without invariant/size trigger.     |

## Summary

- Total files: 5
- Moves (Current != Target): **0**
- All 5 files are already in their target location; the module is correctly flat
  per the MODERATE classification. Cross-module deep-import cleanup (weekly-report
  reaching into `report-sections.prisma-repository` and `review-authz` internals)
  is a **migration-slice-6 concern** (cross-module facade routing), not a file-move —
  out of scope for this per-file mapping.
