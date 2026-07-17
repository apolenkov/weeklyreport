## ADDED Requirements

### Requirement: Dead API surface identified by code review MUST be deleted, not documented as intentional

The backlog MUST record that a code-review sweep found nine dead-surface findings in `apps/api` — `shutdownOtel` (`otel.bootstrap.ts`), the `pdfExportRouter` module (`modules/pdf-export/pdf-export.router.ts`, superseded by `infrastructure/trpc/routers/pdf-export.router.ts`), `applyTransition`/`runTransition` (`period-transition.apply.ts`), `getReportStatus` on `ReportSectionsRepository` plus the doc comment on `report-sections.service.ts` that falsely claimed a `getReportStatus` fallback exists, `getLatestPublishedId` on `WeeklyReportRepository` (repo, service, and Prisma query), and the `leadHeadAdminProcedure` canonical builder in `trpc.middleware.ts` — each reachable only from its own unit test, never from production code. Every one of these is deleted by `remove-dead-surface-api`, and the `role-coverage-gate` spec's canonical-builder count is corrected from 9 to 8 in the same change.

#### Scenario: Every deleted symbol is confirmed caller-free before removal

- **WHEN** each symbol named above is grepped repo-wide prior to deletion
- **THEN** the only hits are its own declaration and its own test file (or, for `pdfExportRouter`, the one stale test importing it)
- **AND** no production module imports or calls it

#### Scenario: The report-sections doc comment matches real control flow

- **WHEN** `evaluateDeadlineGate` is inspected after this change
- **THEN** it returns `false` directly when `getReportMeta` is not implemented, with no call to a `getReportStatus`-shaped fallback
- **AND** the `getReportMeta` doc comment states that plain fact instead of describing a fallback that never runs

#### Scenario: The role-coverage gate's builder count stays accurate

- **WHEN** `openspec/specs/role-coverage-gate/spec.md` and its allow-list test are inspected after this change
- **THEN** both enumerate exactly 8 canonical builders
- **AND** neither references `leadHeadAdminProcedure`
