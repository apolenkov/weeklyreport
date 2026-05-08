# Reporting Scope + Submit Validation Evidence - 2026-05-08

Purpose: close the user-reported bug class where a lead could be blocked by a
product they own as metadata but do not have any assigned SDLC stages for.

## Scope Rule

```text
ReportSection.projects source:
  User.stageAssignments -> project/stage ownership

Project.leadId source:
  metadata/future notifications only
```

## Code Evidence

```text
apps/api/src/modules/report-sections/report-sections.prisma-repository.ts
  mapPrismaToReportSection()
  builds projects from row.author.stageAssignments

apps/api/src/modules/report-sections/report-sections.service.ts
  validateSubmitInput(section, input)
  validates only section.projects
```

## Regression Added

```text
apps/api/src/modules/report-sections/report-sections.integration.test.ts
  getSectionById excludes product-owner projects without StageAssignment
  submitSection ignores product-owner projects without StageAssignment

apps/api/src/modules/report-sections/report-sections.service.test.ts
  submits by read-model scope and does not require owner-only projects
```

## Commands

```bash
rtk proxy pnpm --filter @customreport/api test -- \
  report-sections.service.test.ts report-sections.contract.test.ts
rtk proxy pnpm --filter @customreport/api exec vitest run \
  --config vitest.integration.config.ts \
  --reporter=verbose \
  --fileParallelism=false \
  src/modules/report-sections/report-sections.integration.test.ts
```

Result:

```text
PASS
unit:
  Test Files: 57 passed
  Tests: 660 passed

integration:
  Test Files: 1 passed
  Tests: 7 passed
```

Previously blocked, now resolved:

```text
Docker/DB access restored.
customreport_test schema is up to date.
Integration scenario passed against live test DB.
```

## Verdict

```text
UFB-002: PASS
UFB-003: PASS
```
