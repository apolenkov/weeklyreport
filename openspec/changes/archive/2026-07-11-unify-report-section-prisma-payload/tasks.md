## 1. Core type

- [x] 1.1 `reportSectionFullInclude` gains `satisfies Prisma.ReportSectionInclude`.
- [x] 1.2 Replace `PrismaReportSectionWithRelations` with `Prisma.ReportSectionGetPayload<{include: typeof reportSectionFullInclude}>`; delete the hand-written interface and the now-unused `RecordCommentRow`/`SectionReviewRow` mirrors if the generated payload subsumes their use.
- [x] 1.3 `mapPrismaToReportSection` — drop the two production casts (`getSectionById`, `saveSection` re-read); remove now-unreachable optional guards (`late ?? false` recast, `project.stageAssignments ?? []`, `recordComments ?? []` ×3, `activityStatuses ?? []`, `sectionReviews ?? []`); keep guards over genuinely nullable columns (`projectStatuses[].status`, item/risk/decision `.project`).
- [x] 1.4 Move the post-save re-read inside the `$transaction` callback; throw `SectionVersionConflictError` if it's unexpectedly empty.

## 2. Other production call sites

- [x] 2.1 `carry-over.prisma-repository.ts`: drop both casts + the now-unused type import.
- [x] 2.2 `pdf-export.prisma-repository.ts`: drop the nested cast + the now-unused type import.
- [x] 2.3 `lead-form.prisma-repository.ts`: drop the three `Parameters<typeof mapPrismaToReportSection>[0]` casts and the two redundant `report`/`reopenRequests` narrowing casts on `getSectionForPeriod`.
- [x] 2.4 `published-report-snapshot.ts`: derive `SnapshotReportRow`/`SnapshotSectionRow` from `Prisma.ReportGetPayload<{include: typeof reportFullIncludeForSnapshot}>`; drop the cast.
- [x] 2.5 `weekly-report.prisma-repository.ts`: drop the `any[]` cast + its eslint-disable comment.
- [x] 2.6 `report-sections/index.ts` barrel: verify it re-exports the (now generated-derived) type by reference — confirmed no edit needed, consumer import paths unchanged.

## 3. Tests

- [x] 3.1 Re-point the three fixture-builder casts (report-sections, carry-over/weekly-report test doubles as applicable) to the new type.
- [x] 3.2 Fix the "skips rows without a loaded project relation" fixture: `project: undefined` → `project: null`.
- [x] 3.3 Add a regression test: the post-save re-read inside the transaction, and a concurrent-deletion scenario returning `SectionVersionConflictError` instead of throwing.

## 4. Spec

- [x] 4.1 New capability `report-section-prisma-payload`; MODIFIED `architecture-refactor-backlog` closing the follow-up with the corrected ten-site inventory.

## 5. Verification

- [x] 5.1 `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- [x] 5.2 `pnpm test:integration` (single-thread, shared DB)
- [x] 5.3 `pnpm format:check`
- [x] 5.4 Residual sweep: `as unknown as PrismaReportSectionWithRelations` (or the type's new name) returns zero production hits; `any[]` cast in weekly-report gone.
- [x] 5.5 `openspec validate unify-report-section-prisma-payload --strict`
