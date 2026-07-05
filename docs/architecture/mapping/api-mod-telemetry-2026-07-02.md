# Mapping — api-mod-telemetry (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-telemetry-2026-07-02.md`.
Target structure: `docs/architecture/TARGET-STRUCTURE-2026-07-02.md`.

`telemetry` is classified as **THIN CRUD** in the target tree (target-structure doc,
apps/api target tree, line ~156-157: "activity/ project-activity/ email/ observability/
search/ telemetry/ organization/ analytics/ ... stay flat: X.service.ts + X.prisma-repo.ts").
Determinism knob 2 (api internal split trigger) confirms: a module stays flat until it
either bears a load-bearing invariant or exceeds ~6 files. This module has exactly 6 files,
no documented invariant — stays flat, no `domain/application/infrastructure` split.

All 6 files already live directly under `apps/api/src/modules/telemetry/` with no
subfolder nesting, which is exactly the target shape. Result: zero moves.

| Current path                                                  | Target path                                                   | Layer                                                      | Domain    | Move? | Note                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- | --------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/api/src/modules/telemetry/telemetry.cache.ts             | apps/api/src/modules/telemetry/telemetry.cache.ts             | infrastructure (adapter, flat-module convention)           | telemetry | no    | Redis cache adapter; thin module keeps adapters flat at module root, not under `infrastructure/`.                                                                                                                     |
| apps/api/src/modules/telemetry/telemetry.gauges.ts            | apps/api/src/modules/telemetry/telemetry.gauges.ts            | infrastructure (adapter, flat-module convention)           | telemetry | no    | Prisma-backed Prometheus gauges; defines its own port + adapter but the module itself stays flat (rule: split only past ~6 files or an invariant — neither holds).                                                    |
| apps/api/src/modules/telemetry/telemetry.module.ts            | apps/api/src/modules/telemetry/telemetry.module.ts            | module-wiring                                              | telemetry | no    | NestJS module; module-wiring files stay at module root in every module shape (thin or invariant-bearing).                                                                                                             |
| apps/api/src/modules/telemetry/telemetry.prisma-repository.ts | apps/api/src/modules/telemetry/telemetry.prisma-repository.ts | infrastructure (adapter, flat-module convention)           | telemetry | no    | Matches thin-module naming convention `X.prisma-repository.ts` exactly.                                                                                                                                               |
| apps/api/src/modules/telemetry/telemetry.queries.ts           | apps/api/src/modules/telemetry/telemetry.queries.ts           | infrastructure (repository helper, flat-module convention) | telemetry | no    | Prisma query helper shared by prisma-repository + gauges; imports PrismaService so it is infrastructure, not domain — stays flat, no separate subfolder warranted for a single helper file.                           |
| apps/api/src/modules/telemetry/telemetry.service.ts           | apps/api/src/modules/telemetry/telemetry.service.ts           | application (service, flat-module convention)              | telemetry | no    | Assembles TelemetrySummary; owns the TelemetryRepository/TelemetryCachePort interfaces per the port pattern, but module stays flat (no `application/` subfolder) since telemetry is thin CRUD, not invariant-bearing. |

## Moves count

0 of 6 rows have Current != Target. Telemetry requires no file moves under the target
structure — it is already in its canonical flat, thin-module shape. No OpenSpec migration
slice is needed for this module (it isn't listed among migration slices 1-6, consistent
with staying flat).
