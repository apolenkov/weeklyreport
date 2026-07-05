# Mapping — api-mod-email (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-email-2026-07-02.md`.
Target reference: `docs/architecture/TARGET-STRUCTURE-2026-07-02.md`.

`email` is listed explicitly under **THIN CRUD — stays flat** in the target api tree
(`activity/ project-activity/ email/ observability/ search/ telemetry/ organization/
analytics/`). Per determinism knob 2 (api internal split trigger), a module stays flat
until it bears a load-bearing invariant or exceeds ~6 files; email has 3 files and no
invariant (it's a template-render utility consumed by the notification/reminders flow,
not an owner of atomic state). So no `domain/application/infrastructure` split applies —
every file keeps its current path.

| Current path                                                 | Target path                                                  | Layer                                           | Domain | Move? | Note                                                                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------- | ------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/api/src/modules/email/render-template.ts                | apps/api/src/modules/email/render-template.ts                | util (module root)                              | email  | no    | Thin-CRUD module stays flat per Target tree; dispatcher used by reminders/notification worker. No invariant → no `domain/`/`application/` split (knob 2). |
| apps/api/src/modules/email/templates/deadline.template.tsx   | apps/api/src/modules/email/templates/deadline.template.tsx   | component (module root, `templates/` subfolder) | email  | no    | Presentation template, not a port/adapter; `templates/` is a natural sub-bucket under a flat thin module, not a hexagon layer.                            |
| apps/api/src/modules/email/templates/escalation.template.tsx | apps/api/src/modules/email/templates/escalation.template.tsx | component (module root, `templates/` subfolder) | email  | no    | Same as above — thin CRUD module, no move.                                                                                                                |

## Summary

- Files in catalog: 3
- Rows with Current != Target: **0**
- Rationale: email is explicitly named as a thin-CRUD module in the Target tree (stays
  `X.service.ts` + `X.prisma-repository.ts` style, no ports/hexagon layering); this
  catalog slice doesn't even show a service/repository file, only the render-template
  utility + two React-email templates — well under the ~6-file split trigger, so the
  grouping rule places every file exactly where it already lives.
