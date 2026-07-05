# Mapping — api-mod-organization (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-organization-2026-07-02.md` (3 files).

Grouping-rule result: `organization` is listed explicitly under Target tree's **THIN CRUD**
bucket (`activity/ project-activity/ email/ observability/ search/ telemetry/ organization/
analytics/`) — stays flat (`X.service.ts` + `X.prisma-repository.ts` + `X.module.ts` at the
module root, no `domain/application/infrastructure` split). Determinism knob 2 (api internal
split trigger) also confirms this: the module has 3 files, well under the ~6-file /
load-bearing-invariant threshold that would justify a split. Current paths already match this
target shape exactly — no moves.

| Current path                                                        | Target path                                                         | Layer                          | Domain       | Move? | Note                                                                                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------ | ------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| apps/api/src/modules/organization/organization.module.ts            | apps/api/src/modules/organization/organization.module.ts            | module-wiring                  | organization | no    | Thin-CRUD module; stays flat at module root per Target tree.                                                                           |
| apps/api/src/modules/organization/organization.prisma-repository.ts | apps/api/src/modules/organization/organization.prisma-repository.ts | infrastructure (adapter, flat) | organization | no    | Adapter stays a flat `X.prisma-repository.ts` sibling — no `infrastructure/` subfolder; module has no invariant and <6 files (knob 2). |
| apps/api/src/modules/organization/organization.service.ts           | apps/api/src/modules/organization/organization.service.ts           | application (service, flat)    | organization | no    | Service stays a flat `X.service.ts`; no `application/` subfolder warranted.                                                            |

**Moves = 0.** All 3 files already sit at their target path; the module already satisfies the
"thin CRUD stays flat" rule with no restructuring required.
