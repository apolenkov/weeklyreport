# Mapping — web-comp-ui (2026-07-02)

Source catalog: `docs/architecture/catalog/web-comp-ui-2026-07-02.md` (2 files).
Grouping rule applied: both files are `component` layer / `shared-ui` domain —
generic, business-agnostic primitives (confirm dialog, portal tooltip) with no
single-slice owner and reusable across features. Per Grouping rules axis 2
("web: business-agnostic + reused by ≥2 slices → `src/shared/`") and the
target tree's `shared/ui/` bucket (report-shell/common/navigation primitives,
web-only components not in `@customreport/ui`), both land in
`apps/web/src/shared/ui/`.

| Current path                                       | Target path                                    | Layer     | Domain    | Move? | Note                                                                                                                                                                                                                                    |
| -------------------------------------------------- | ---------------------------------------------- | --------- | --------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/web/src/components/ui/confirmation-dialog.tsx | apps/web/src/shared/ui/confirmation-dialog.tsx | component | shared-ui | yes   | Generic reusable primitive, not slice-owned; rule-of-2 (web) already satisfied (used by submit/publish/reopen/revoke/fill-from/version-restore/delete presets across multiple slices) → `shared/ui/` per axis-2 business-agnostic rule. |
| apps/web/src/components/ui/sdlc-tooltip.tsx        | apps/web/src/shared/ui/sdlc-tooltip.tsx        | component | shared-ui | yes   | Portal-based tooltip primitive with no domain logic of its own; consumed wherever SDLC stage chips render (dashboard/period/report-sections slices) → `shared/ui/` per axis-2 business-agnostic rule.                                   |

## Summary

- 2 files cataloged, 2 rows.
- Moves (Current != Target): **2** (both `components/ui/*` → `shared/ui/*`, part of the
  `app/` = routing-only / `features/` = slices / `shared/` = agnostic reshape in migration
  slice 3 — "`report-shell`/`common`/`ui` primitives → `shared/`").
- No renames beyond directory relocation; filenames unchanged.
