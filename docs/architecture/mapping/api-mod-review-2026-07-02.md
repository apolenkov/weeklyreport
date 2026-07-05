# Mapping — api-mod-review (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-review-2026-07-02.md` (6 files).
Target doc: `docs/architecture/TARGET-STRUCTURE-2026-07-02.md`.

`review` is one of the three INVARIANT-BEARING api modules (period, report-sections,
review/publication) called out in the Target tree — it gets the full internal
`domain/ application/ infrastructure/` split (migration slice 4), not the flat
`X.service.ts` + `X.prisma-repository.ts` shape thin CRUD modules keep.

Layer assignment per Grouping rules Axis 2 (api): `domain/` = pure, zero framework
imports; `application/` = use-case service + the port interface it owns;
`infrastructure/` = adapters (`*.prisma-repository.ts`); module-wiring stays at the
module root (binds port→adapter by token, per the `period.module.ts` pattern).

| Current path                                                    | Target path                                                                    | Layer          | Domain | Move? | Note                                                                                                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------- | ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| apps/api/src/modules/review/review-authz.ts                     | apps/api/src/modules/review/domain/review-authz.ts                             | domain         | review | yes   | Pure predicates (scope coverage, reviewer designation, period-editability), zero `@prisma`/`@nestjs` imports — canonical domain/ candidate per rule 5.                         |
| apps/api/src/modules/review/review.service.ts                   | apps/api/src/modules/review/application/review.service.ts                      | application    | review | yes   | Defines the `ReviewRepository` port + the use-case service (submission-dashboard read path) — port lives with its owning service, per the period.service.ts precedent.         |
| apps/api/src/modules/review/review-actions.service.ts           | apps/api/src/modules/review/application/review-actions.service.ts              | application    | review | yes   | Defines `ReviewActionsRepository` port + write-surface use-case service (acknowledge/comment/verdict).                                                                         |
| apps/api/src/modules/review/review.prisma-repository.ts         | apps/api/src/modules/review/infrastructure/review.prisma-repository.ts         | infrastructure | review | yes   | Imports `PrismaService`/`@prisma/client` — adapter, per rule 5 (imports `@prisma/client` → infrastructure, never domain).                                                      |
| apps/api/src/modules/review/review-actions.prisma-repository.ts | apps/api/src/modules/review/infrastructure/review-actions.prisma-repository.ts | infrastructure | review | yes   | Same as above; also calls report-sections' `applyRevokeTransition` — cross-module facade call stays as-is (no change to that dependency here).                                 |
| apps/api/src/modules/review/review.module.ts                    | apps/api/src/modules/review/review.module.ts                                   | module-wiring  | review | no    | Module root stays put — binds services to repositories via factory providers, matching `period.module.ts`'s "binds port→adapter by token" role; no subfolder for wiring files. |

## Summary

- 6 files total, **5 moves**, 1 no-move (module-wiring file stays at module root).
- This is the internal-split step only (migration slice 4: "formalize existing ports
  in the invariant modules"); no cross-module import rewiring is implied here — that's
  slice 6 (facade-only cross-module access, currently ratcheted/allowlisted).
- No product code touched by this mapping exercise — plan only.
