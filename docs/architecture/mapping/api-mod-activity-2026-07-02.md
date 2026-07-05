# Mapping — api-mod-activity (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-activity-2026-07-02.md`.

Grouping rule applied: `activity` is listed explicitly among the THIN CRUD modules
(`activity/ project-activity/ email/ observability/ search/ telemetry/ organization/
analytics/`) in the target tree (TARGET-STRUCTURE-2026-07-02.md line 156-157). Thin
modules stay **flat at the module root** — `X.module.ts` + `X.service.ts` +
`X.prisma-repository.ts`, no `domain/application/infrastructure` subfolders (those are
reserved for invariant-bearing modules per the note under the tree). All three files
already live at `apps/api/src/modules/activity/` with exactly this flat shape, so every
file's current path already equals its target path.

| Current path                                                | Target path                                                 | Layer         | Domain    | Move? | Note                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------- | ------------- | --------- | ----- | -------------------------------------------------------------- |
| apps/api/src/modules/activity/activity.module.ts            | apps/api/src/modules/activity/activity.module.ts            | module-wiring | analytics | no    | Thin CRUD module root file; already flat, matches target tree. |
| apps/api/src/modules/activity/activity.prisma-repository.ts | apps/api/src/modules/activity/activity.prisma-repository.ts | repository    | analytics | no    | Thin CRUD module root file; already flat, matches target tree. |
| apps/api/src/modules/activity/activity.service.ts           | apps/api/src/modules/activity/activity.service.ts           | service       | analytics | no    | Thin CRUD module root file; already flat, matches target tree. |

## Summary

- Files in catalog: 3
- Rows with Current != Target: **0**
- No physical moves required for this module. The `activity` module is already an
  exemplar of the THIN CRUD target shape.
