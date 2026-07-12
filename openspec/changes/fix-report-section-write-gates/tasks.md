## 1. Shared period-status lookup on the write-path repository

- [ ] 1.1 Add a section-keyed period-status method to the
      `ReportSectionsRepository` port in
      `report-sections.service.ts` (mirror the existing
      `getReportPeriodStatusForSection` shape on the lead-form port:
      `(sectionId: string) => Promise<string | null>`, selecting
      `report.periodStatus`)
- [ ] 1.2 Implement it in `report-sections.prisma-repository.ts` next to
      `getReportStatus`, selecting `{ report: { select: { periodStatus: true } } }`
      keyed on the section id
- [ ] 1.3 Add the new method to every in-memory / stub repository used in the
      service and contract tests (`report-sections.service.test.ts`,
      `report-sections.contract.test.ts`,
      `report-sections.published-lock.test.ts`,
      `report-sections.activity-status.test.ts`, and any other stub of the port)

## 2. Gate saveDraft on periodStatus

- [ ] 2.1 In `saveDraft`, replace the `getReportStatus`-based
      `reportStatus === "published"` check with a `periodStatus` read via the new
      lookup; reject with `SECTION_ALREADY_SUBMITTED` only when
      `periodStatus === "published"`, allowing `"open"` and `"reopened"`
- [ ] 2.2 Keep the existing `section.status === "submitted"` read-only rejection
      unchanged

## 3. Gate submitSection on periodStatus

- [ ] 3.1 In `submitSection`, add a `periodStatus === "published"` rejection
      before the destructive `saveSection` write, using the same lookup; do NOT
      re-add an already-submitted check (it lives in `validateSubmitInput`)
- [ ] 3.2 Keep the deadline gate, stage-ownership, activity-attachment,
      published-records-preserved, and `validateSubmitInput` checks in their
      current order

## 4. Coverage

- [ ] 4.1 Unit: `saveDraft` succeeds when `periodStatus === "reopened"` (the
      legacy status column still reads `"published"`); `saveDraft` rejects when
      `periodStatus === "published"`
- [ ] 4.2 Unit: `submitSection` rejects a `draft` section when
      `periodStatus === "published"`; succeeds on `"open"`/`"reopened"`
- [ ] 4.3 Integration: autosave against a reopened period persists the draft; a
      submit against a draft section of a published report is rejected and leaves
      the section's `item`/`risk`/`decision` rows unchanged

## 5. Spec delta

- [ ] 5.1 ADD the `report-section-write-gates` capability requirements (draft
      gate, submit gate, automated coverage)

## 6. Gates and verification

- [ ] 6.1 `pnpm --filter @customreport/api db:generate`
- [ ] 6.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 6.3 `pnpm test:integration`
- [ ] 6.4 `npx openspec validate fix-report-section-write-gates --strict`
