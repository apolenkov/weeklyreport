# Mapping — api-mod-publication (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-publication-2026-07-02.md`.

`publication` is called out explicitly in TARGET-STRUCTURE-2026-07-02.md (Target tree,
`modules/period/ … review/ publication/ # INVARIANT-BEARING — same split`) as an
invariant-bearing module (publish atomicity + snapshot), so it gets the full
`domain/application/infrastructure` internal split, mirroring `period/`.

| Current path                                                      | Target path                                                                      | Layer          | Domain      | Move? (yes/no/rename) | Note                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------- | ----------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/api/src/modules/publication/publication.module.ts            | apps/api/src/modules/publication/publication.module.ts                           | module-wiring  | publication | no                    | Stays at module root — binds port→adapter by token, same as `period.module.ts`. Only its internal wiring comment (`PublicationPrismaRepository` → application-layer token) needs updating once the port moves.                        |
| apps/api/src/modules/publication/publication.service.ts           | apps/api/src/modules/publication/application/publication.service.ts              | application    | publication | rename (move)         | Domain use-case service (assembles/sorts report, portfolio overview, immutability enforcement, publish orchestration) + its `PublicationRepository` port belong in `application/`, matching `period.service.ts` + `PeriodRepository`. |
| apps/api/src/modules/publication/publication.prisma-repository.ts | apps/api/src/modules/publication/infrastructure/publication.prisma-repository.ts | infrastructure | publication | rename (move)         | Prisma adapter (compare-and-set guarded publish + snapshot write, scheduler auto-publish) — same role as `period.prisma-repository.ts` in `infrastructure/`.                                                                          |

## Notes

- No pure framework-free "domain" file exists yet in this module (unlike `period-transition.ts`
  for `period/`) — the 3 cataloged files split 2-of-3 into `application/`+`infrastructure/`
  and leave the module-wiring file at the root. A `domain/` subfolder is not populated by this
  mapping; if publish-atomicity invariant logic is later extracted into a pure function, it
  would land under `modules/publication/domain/`.
- `PublicationRepository` (the port/interface) currently lives inside `publication.service.ts`
  and travels with it into `application/`, per the `PeriodRepository`-in-`period.service.ts`
  precedent.
- Moves = 2 (the service and the prisma-repository); the module file's path is unchanged.
