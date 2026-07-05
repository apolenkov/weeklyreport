# Mapping — api-mod-analytics (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-analytics-2026-07-02.md`
Rule basis: `docs/architecture/TARGET-STRUCTURE-2026-07-02.md` — Grouping rules + Target tree.

`analytics` is listed explicitly under **THIN CRUD** in the api target tree
(`activity/ project-activity/ email/ observability/ search/ telemetry/
organization/ analytics/ — stay flat: X.service.ts + X.prisma-repository.ts`).
Per determinism knob 2 (api internal split trigger), a module stays flat until
it either bears a load-bearing invariant or exceeds ~6 files — analytics has
5 files and no dual-state/atomicity invariant, so it does not qualify for the
`domain/application/infrastructure` split. Every file keeps its current path;
this is a zero-move module.

| Current path                                                  | Target path                                                   | Layer         | Domain    | Move? | Note                                                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------- | ------------- | --------- | ----- | ------------------------------------------------------------------------------------------------------------------------- |
| apps/api/src/modules/analytics/analytics-period-math.ts       | apps/api/src/modules/analytics/analytics-period-math.ts       | util          | analytics | no    | Pure, Prisma-free — satisfies domain-purity rule already; stays flat, no `domain/` subfolder needed at thin-CRUD size.    |
| apps/api/src/modules/analytics/analytics.cache.ts             | apps/api/src/modules/analytics/analytics.cache.ts             | adapter       | analytics | no    | Redis cache adapter; would become an `infrastructure/` file only if analytics graduated to invariant-bearing — it hasn't. |
| apps/api/src/modules/analytics/analytics.module.ts            | apps/api/src/modules/analytics/analytics.module.ts            | module-wiring | analytics | no    | Module-root wiring stays at module root regardless of flat/split status.                                                  |
| apps/api/src/modules/analytics/analytics.prisma-repository.ts | apps/api/src/modules/analytics/analytics.prisma-repository.ts | repository    | analytics | no    | Prisma adapter; thin-CRUD modules keep `X.prisma-repository.ts` flat, not moved under `infrastructure/`.                  |
| apps/api/src/modules/analytics/analytics.service.ts           | apps/api/src/modules/analytics/analytics.service.ts           | service       | analytics | no    | Owns the repository/cache port contracts; thin-CRUD modules keep `X.service.ts` flat, not moved under `application/`.     |

## Summary

- Files in catalog: 5
- Rows with Current != Target: **0**
- Rationale: analytics is explicitly a THIN CRUD module in the target tree — no
  moves, no renames, no internal split. If analytics ever grows a load-bearing
  invariant or crosses ~6 files (determinism knob 2), re-run this mapping.
