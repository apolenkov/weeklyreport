# Mapping — api-mod-search (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-search-2026-07-02.md`.
Applied rule: `search` is listed under **THIN CRUD** modules (Target tree, api section) —
stays flat as `X.service.ts` + `X.prisma-repository.ts` + `X.module.ts` at the module root,
no `domain/application/infrastructure` split (Grouping rules, determinism knob 2: a module
only grows internal layering once it bears a load-bearing invariant or exceeds ~6 files;
search has 3 files and no invariant). Domain axis: `search` is its own canonical domain
(Grouping rules axis 1, "own domain" list). No moves required — the module already matches
its target shape.

| Current path                                            | Target path                                             | Layer          | Domain | Move? | Note                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------- | -------------- | ------ | ----- | ------------------------------------------------------------------------------------- |
| apps/api/src/modules/search/search.module.ts            | apps/api/src/modules/search/search.module.ts            | module-wiring  | search | no    | Thin-CRUD module stays flat at module root; already canonical.                        |
| apps/api/src/modules/search/search.prisma-repository.ts | apps/api/src/modules/search/search.prisma-repository.ts | infrastructure | search | no    | Adapter; imports Prisma — correctly flat, not promoted into an `infrastructure/` sub. |
| apps/api/src/modules/search/search.service.ts           | apps/api/src/modules/search/search.service.ts           | application    | search | no    | Owns the `SearchRepository` port; flat per thin-CRUD rule (3 files, no invariant).    |

## Summary

- Files in catalog: 3
- Rows with Current != Target: **0**
- Rationale: search is explicitly named in the Target tree's THIN CRUD list
  (`activity/ project-activity/ email/ observability/ search/ telemetry/ organization/ analytics/`)
  and already has exactly the flat `service + prisma-repository + module` shape prescribed —
  no domain/application/infrastructure split, no relocation.
