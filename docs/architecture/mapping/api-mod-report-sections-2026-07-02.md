# Mapping — api-mod-report-sections (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-report-sections-2026-07-02.md`.
`report-sections` is INVARIANT-BEARING (role-coverage + section lifecycle + published-record
lock) — Target-Structure doc mandates the full `domain/application/infrastructure` internal
split (mirroring `period/`), landed in migration slice 4. `*.module.ts` stays at the module
root (binds port→adapter by token; not a domain/application/infrastructure file itself).

Layer assignment applies Grouping-rule Axis 2 + determinism knob 5 (pure vs adapter): any file
importing `@prisma/client`/`PrismaService`/`Prisma.TransactionClient` → `infrastructure/`; a
service orchestrating a use-case → `application/`; framework-free pure logic (merges, guards,
error/port contracts, eligibility rules) → `domain/`.

| Current path                                                              | Target path                                                                              | Layer          | Domain          | Move? | Note                                                                                                                                                                                    |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------- | --------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/api/src/modules/report-sections/ensure-lead-section.ts               | apps/api/src/modules/report-sections/infrastructure/ensure-lead-section.ts               | infrastructure | report-sections | yes   | Direct `PrismaClient` writes (reportSection/project/projectStatus/…) — adapter, not domain.                                                                                             |
| apps/api/src/modules/report-sections/lead-form-cross-author-scope.ts      | apps/api/src/modules/report-sections/domain/lead-form-cross-author-scope.ts              | domain         | report-sections | yes   | Pure scope-resolution/filter logic over the `LeadFormRepository` port and shared read-model types; no framework import.                                                                 |
| apps/api/src/modules/report-sections/lead-form-shared.ts                  | apps/api/src/modules/report-sections/domain/lead-form-shared.ts                          | domain         | report-sections | yes   | Framework-free error classes + `LeadFormRepository` port interface + `computeReopenEligibility` rule — the domain contract the prisma-repo adapter implements and the service consumes. |
| apps/api/src/modules/report-sections/lead-form.prisma-repository.ts       | apps/api/src/modules/report-sections/infrastructure/lead-form.prisma-repository.ts       | infrastructure | report-sections | yes   | Prisma-backed `LeadFormRepository` adapter implementation.                                                                                                                              |
| apps/api/src/modules/report-sections/lead-form.service.ts                 | apps/api/src/modules/report-sections/application/lead-form.service.ts                    | application    | report-sections | yes   | Use-case facade (revoke, fill-from-previous-period, reopen requests, cross-author reads) orchestrating the domain port.                                                                 |
| apps/api/src/modules/report-sections/published-lineage.ts                 | apps/api/src/modules/report-sections/infrastructure/published-lineage.ts                 | infrastructure | report-sections | yes   | Reads via `PrismaService` and `Report.publishedSnapshot` — DB-adapter, not pure.                                                                                                        |
| apps/api/src/modules/report-sections/published-record-guard.ts            | apps/api/src/modules/report-sections/domain/published-record-guard.ts                    | domain         | report-sections | yes   | Pure comparison over `@customreport/shared` payload types — no framework import; enforces the delete-lock invariant.                                                                    |
| apps/api/src/modules/report-sections/report-section-merge.ts              | apps/api/src/modules/report-sections/domain/report-section-merge.ts                      | domain         | report-sections | yes   | Pure merge of draft payload onto the read model; no framework import.                                                                                                                   |
| apps/api/src/modules/report-sections/report-sections.module.ts            | apps/api/src/modules/report-sections/report-sections.module.ts                           | module-wiring  | report-sections | no    | Stays at module root — binds port→adapter tokens; Target-tree keeps `*.module.ts` outside the domain/application/infrastructure subfolders.                                             |
| apps/api/src/modules/report-sections/report-sections.prisma-repository.ts | apps/api/src/modules/report-sections/infrastructure/report-sections.prisma-repository.ts | infrastructure | report-sections | yes   | Prisma-backed `ReportSectionsRepository` adapter (full-relation include + row mapper + CRUD).                                                                                           |
| apps/api/src/modules/report-sections/report-sections.service.ts           | apps/api/src/modules/report-sections/application/report-sections.service.ts              | application    | report-sections | yes   | Core draft-save/submit use-case service; owns the `ReportSectionsRepository` port interface it depends on.                                                                              |
| apps/api/src/modules/report-sections/revoke-transition.ts                 | apps/api/src/modules/report-sections/infrastructure/revoke-transition.ts                 | infrastructure | report-sections | yes   | Writes through `Prisma.TransactionClient` — a DB adapter, not pure domain logic.                                                                                                        |

## Notes

- Catalog header claims "15 files" but lists 12 rows (test files — `*.test.ts`,
  `*.integration.test.ts`, `*.contract.test.ts` — are excluded from the catalog and this
  mapping; not reconciled here, flagging as a pre-existing catalog discrepancy).
- `lead-form-shared.ts` mixes a pure eligibility rule with the `LeadFormRepository` port
  interface. Target-Structure's Axis-2 text says "application = the port interfaces it owns,"
  which would argue for splitting the port interface out into `application/`. This mapping keeps
  the file whole and assigns it to `domain/` (rule 5: zero framework imports, and it is the
  contract `lead-form.prisma-repository.ts` implements) — a call for the implementing OpenSpec
  change to confirm or split.
- No file moves are executed here — this document is the plan only, per the Target-Structure
  doc's "PLANS, not scheduled work" migration-slice framing (slice 4 for this module).
