# Report Domain Data Parity Sweep Findings

Date: 2026-05-15

Scope: Prisma/read model -> API/router -> shared schema -> web mapper -> UI text
for report-domain surfaces.

Demo-review executable was not available in this shell, so the review gate was
emulated with scoped grep, file reads, mapper tests, and post-fix diff review.

## Findings Table

| surface                                             | source truth                                                                                                                       | loss point                                                                        | class                 | fix owner               | proof                                                                                                                                                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| fill-from dropdown period counts                    | reports.myHistory computes itemCount, riskCount, productCount; shared schema accepts them; FillFromButton renders them             | mapLeadPeriods omitted the count fields before this fix                           | BUG fixed             | apps/web mapper         | apps/api/src/infrastructure/trpc/trpc.router.ts:418; packages/shared/src/schemas/report.ts:921; apps/web/src/components/lead/fill-from-button.tsx:170; apps/web/src/lib/mappers/lead-form.ts:513 |
| fill-from dropdown regression coverage              | mapper test covered active/submitted flags only                                                                                    | no assertion pinned count propagation                                             | TEST_GAP fixed        | apps/web tests          | apps/web/src/lib/mappers/lead-form.test.ts:351; apps/web/src/lib/mappers/lead-form.test.ts:374                                                                                                   |
| weekly report decision and priority product slicing | Decision.productId and Priority.productId are present in shared schema and API read models                                         | weekly report mapper grouped decisions/priorities under the section first project | BUG fixed             | apps/web mapper         | packages/shared/src/schemas/report.ts:118; packages/shared/src/schemas/report.ts:126; apps/web/src/lib/mappers/weekly-report.ts:271; apps/web/src/lib/mappers/weekly-report.test.ts:435          |
| weekly report risk severity comment                 | schema now carries optional risk severity and mapper uses it                                                                       | stale mapper comment still said risk schema had no severity                       | DOC_GAP fixed         | apps/web mapper docs    | packages/shared/src/schemas/report.ts:106; apps/web/src/lib/mappers/weekly-report.ts:23                                                                                                          |
| dashboard archive aggregate counts                  | dashboard presentation wants product/risk/decision counts                                                                          | ArchiveReportSummary remains lean and mapper defaults counts to 0                 | CONTRACT_GAP deferred | future archive contract | apps/web/src/lib/mappers/dashboard.ts:18; apps/web/src/lib/mappers/dashboard.ts:223                                                                                                              |
| lead history cards                                  | reports.myHistory, shared schema, and lead-history mapper carry counts, traffic, timestamps, versions                              | no current loss found                                                             | PASS                  | none                    | apps/api/src/infrastructure/trpc/trpc.router.ts:390; apps/web/src/lib/mappers/lead-history.ts:136                                                                                                |
| version history modal                               | repository derives item/risk/decision counts from snapshot data; shared schema defaults legacy rows; mapper surfaces server counts | no current loss found                                                             | PASS                  | none                    | apps/api/src/modules/report-sections/lead-form.prisma-repository.ts:200; packages/shared/src/schemas/report.ts:652; apps/web/src/lib/mappers/lead-form.ts:519                                    |
| activity.live                                       | repository counts items, risks, decisions, priorities and computes lastEditAt                                                      | no current loss found                                                             | PASS                  | none                    | apps/api/src/modules/activity/activity.prisma-repository.ts:73; packages/shared/src/schemas/report.ts:236                                                                                        |
| leadForm.byPeriod                                   | service returns full ReportSectionReadModel/readOnly wrapper                                                                       | no current loss found                                                             | PASS                  | none                    | apps/api/src/modules/report-sections/lead-form.service.ts:207; packages/shared/src/schemas/report.ts:193                                                                                         |
| weeklyReport.get published/open read model          | repository uses published snapshot when present and full live sections otherwise                                                   | no current loss found after productId mapper fix                                  | PASS                  | none                    | apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts:132; apps/web/src/lib/mappers/weekly-report.ts:20                                                                          |

## Post-Fix Review

| Gate                             | Result            | Evidence                                                                                               |
| -------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| source-of-truth alignment        | PASS              | fixed mappers now consume fields already present in shared/API contracts                               |
| tests cover bug class            | PASS              | lead-form count propagation and weekly productId grouping tests added                                  |
| no unrelated dirty files touched | PASS with warning | customreport had pre-existing dirty UI files; changed files are mapper/tests/planning report only      |
| no hidden fallback zeros added   | PASS              | mapLeadPeriods passes optional counts through; weekly productId grouping uses explicit productId first |
| stale comments updated           | PASS              | lead-form and weekly-report comments now match current behavior                                        |

## Deferred Contract Gaps

Archive aggregate counts stay deferred. The current source says
ArchiveReportSummary has no submission/product/risk/decision counts, and
mapArchiveSummary intentionally defaults those fields. This should be solved by
extending the archive contract, not by inventing UI-side counts in this sweep.
