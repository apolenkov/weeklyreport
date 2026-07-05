# Mapping — api-mod-pdf-export (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-pdf-export-2026-07-02.md`.
Grouping rules: `docs/architecture/TARGET-STRUCTURE-2026-07-02.md` (§ Grouping rules, § Target tree — apps/api).

`pdf-export` is listed under **THIN CRUD** in the target tree (`activity/ project-activity/
email/ observability/ search/ telemetry/ organization/ analytics/` — pdf-export explicitly
named again in the `domain/application/infrastructure` note: "the infra ports … are defined by
their consumers (reminders, **pdf-export**, analytics services)"). Per determinism knob 2, a
module stays flat until it bears a load-bearing invariant or exceeds ~6 files. pdf-export has
5 files, no listed invariant (period dual-state / role-coverage / publish atomicity) — it stays
**flat at the module root**: `X.service.ts` + `X.prisma-repository.ts` + `X.router.ts` +
`X.module.ts`, plus its one controller-layer file. No internal `domain/application/infrastructure`
split applies.

| Current path                                                    | Target path                                                     | Layer                 | Domain     | Move? | Note                                                                                                                                                                                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------- | --------------------- | ---------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/api/src/modules/pdf-export/pdf-export.download-handler.ts  | apps/api/src/modules/pdf-export/pdf-export.download-handler.ts  | controller            | pdf-export | no    | Thin module stays flat (rule: split only on invariant or >~6 files). Controller-style Express handler has no dedicated segment in a flat module — stays at module root.                                                                       |
| apps/api/src/modules/pdf-export/pdf-export.module.ts            | apps/api/src/modules/pdf-export/pdf-export.module.ts            | module-wiring         | pdf-export | no    | Module-wiring file always lives at the module root, flat or split.                                                                                                                                                                            |
| apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts | apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts | repository (adapter)  | pdf-export | no    | Would be `infrastructure/` only if the module graduated to a full split; thin module keeps it flat.                                                                                                                                           |
| apps/api/src/modules/pdf-export/pdf-export.router.ts            | apps/api/src/modules/pdf-export/pdf-export.router.ts            | router (interface)    | pdf-export | no    | Interface layer; wired via `infrastructure/trpc` router registry, file itself stays at module root for a flat module.                                                                                                                         |
| apps/api/src/modules/pdf-export/pdf-export.service.ts           | apps/api/src/modules/pdf-export/pdf-export.service.ts           | service (application) | pdf-export | no    | Core use-case logic; would be `application/` only under a full split. Future migration slice 5 (api: wrap infra as ports) will have this file define an EmailPort/QueuePort-style seam over BullMQ **in place**, without relocating the file. |

## Summary

5/5 files: **no moves**. pdf-export is correctly flat today and the target structure keeps it
flat (thin-CRUD bucket, below the ~6-file / no-invariant split trigger). The only forward-looking
change named for this module in the target doc is **migration slice 5** (wrap `infrastructure/bullmq`
as a QueuePort consumed here) — a port-seam change inside `pdf-export.service.ts`, not a file
relocation.
