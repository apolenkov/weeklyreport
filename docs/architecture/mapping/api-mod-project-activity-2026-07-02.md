# Mapping — api-mod-project-activity (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-project-activity-2026-07-02.md`.
Target-structure ref: `docs/architecture/TARGET-STRUCTURE-2026-07-02.md` (Target tree §apps/api,
Grouping rules).

`project-activity` is listed explicitly under the THIN CRUD bucket
(`activity/ project-activity/ email/ observability/ search/ telemetry/ organization/ analytics/`)
— stays flat as `X.service.ts` + `X.prisma-repository.ts` + `X.module.ts` at the module root, no
`domain/application/infrastructure` split (determinism knob 2: flat until load-bearing invariant
or >~6 files; this module has 3). Domain = `project-activity` (its own canonical domain, per the
"+ … project-activity …" line in the domain table). No file needs to move.

| Current path                                                                | Target path                                                                 | Layer                                                    | Domain           | Move? | Note                                                                                                                                       |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| apps/api/src/modules/project-activity/project-activity.module.ts            | apps/api/src/modules/project-activity/project-activity.module.ts            | module-wiring                                            | project-activity | no    | Thin CRUD module; stays flat at module root.                                                                                               |
| apps/api/src/modules/project-activity/project-activity.prisma-repository.ts | apps/api/src/modules/project-activity/project-activity.prisma-repository.ts | repository (infrastructure-shaped, but module not split) | project-activity | no    | Imports `@prisma/client`/PrismaService (knob 5) but module stays flat (3 files, no invariant) — no `infrastructure/` subfolder per knob 2. |
| apps/api/src/modules/project-activity/project-activity.service.ts           | apps/api/src/modules/project-activity/project-activity.service.ts           | service                                                  | project-activity | no    | Thin CRUD module; stays flat at module root.                                                                                               |

**Moves: 0** (all 3 files already match their target path — thin-CRUD modules are unchanged by
this reshape).
