# Mutation Consumer Audit

Mutations defined: 48
Queries defined: 44

A mutation is VERIFIED only when every web call site invalidates a real
query (or navigates the page) on its success path. Sibling query names are
not evidence and are not consulted.

- VERIFIED: 18
- PARTIAL: 2
- UNRESOLVED: 25
- BLACK HOLE: 3 (0 unexpected)

## ✓ Allowlisted (intentional)

Black holes with a standing justification.

| Procedure                | Reason                                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| admin.testTelegramSend   | Admin-only smoke-test producer for a transport that is deployed but not yet activated (seeds-only); pinned by a normative scenario in openspec/specs/queue-worker-architecture/spec.md.                                                                            |
| admin.saveReminderRule   | Deliberate soft-deprecation tombstone superseded by admin.savePolicy; admin.contract.test.ts asserts it throws METHOD_NOT_SUPPORTED and never reaches the service.                                                                                                 |
| admin.deleteReminderRule | Deliberate soft-deprecation tombstone paired with admin.saveReminderRule; admin.contract.test.ts asserts it throws METHOD_NOT_SUPPORTED and never reaches the service. Rules are derived from policies and die only with them, so having no consumer is the point. |

## ◐ No read-back found (informational)

The success path was followed end to end and refreshes nothing. Either the caller re-reads by another route, or the user is looking at stale data.

| Procedure                 | Call sites | What runs on success                                                                 |
| ------------------------- | ---------: | ------------------------------------------------------------------------------------ |
| reports.submit            |          1 | features/report-sections/model/lead-form/lead-form-draft-seam.ts: no success handler |
| reminders.dispatchPending |          2 | features/dashboard/ui/alert-bar.tsx: success handler runs no read-back               |

## ? Not classifiable from source (informational)

The success path leaves what static analysis can see. Not a defect on its own — a place the audit declines to guess.

| Procedure                   | Call sites | What could not be followed                                                                                                                                                                                                                                                                                         |
| --------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| reports.saveDraft           |          2 | features/report-sections/model/autosave/autosave-mutation.ts: cannot follow deps.getRefs(), cannot follow deps.onVersionChange(), cannot follow deps.setLastSavedKey(), cannot follow deps.onSaved(), cannot follow deps.setState(), cannot follow deps.setLastSavedAt(), invalidateQueries() names no known query |
| review.comment              |          1 | features/review/ui/comments/record-comments.tsx: cannot follow setDraft(), invalidateQueries() names no known query, cannot follow onMutated()                                                                                                                                                                     |
| review.deleteComment        |          1 | features/review/ui/comments/record-comments.tsx: invalidateQueries() names no known query, cannot follow onMutated()                                                                                                                                                                                               |
| review.verdict              |          2 | features/dashboard/ui/request-changes-button.tsx: invalidateQueries() names no known query, cannot follow onMutated()                                                                                                                                                                                              |
| pdfExport.request           |          1 | features/pdf-export/ui/use-pdf-export-job.ts: options are not a literal                                                                                                                                                                                                                                            |
| admin.updateSettings        |          1 | shared/ui/settings/settings-tab.tsx: invalidateQueries() names no known query, cannot follow onSaved(), cannot follow fetch()                                                                                                                                                                                      |
| admin.updateOrganization    |          1 | features/organization/ui/settings-identity-sub-tab.tsx: cannot follow setSubmitted(), cannot follow setDraft(), invalidateQueries() names no known query, cannot follow fetch()                                                                                                                                    |
| admin.saveUser              |          1 | features/admin/model/users-tab-mutations.ts: invalidateQueries() names no known query, cannot follow after()                                                                                                                                                                                                       |
| admin.deleteUser            |          1 | features/admin/model/users-tab-mutations.ts: invalidateQueries() names no known query, cannot follow after()                                                                                                                                                                                                       |
| admin.deactivateUser        |          1 | features/admin/model/users-tab-mutations.ts: invalidateQueries() names no known query, cannot follow after()                                                                                                                                                                                                       |
| admin.activateUser          |          1 | features/admin/model/users-tab-mutations.ts: invalidateQueries() names no known query, cannot follow after()                                                                                                                                                                                                       |
| admin.saveReportingGroup    |          1 | features/admin/ui/groups-tab.tsx: invalidateQueries() names no known query                                                                                                                                                                                                                                         |
| admin.archiveReportingGroup |          1 | features/admin/ui/groups-tab.tsx: invalidateQueries() names no known query                                                                                                                                                                                                                                         |
| admin.saveProject           |          1 | features/admin/model/products-tab-mutations.ts: invalidateQueries() names no known query, cannot follow onSaved()                                                                                                                                                                                                  |
| admin.deleteProject         |          1 | features/admin/model/products-tab-mutations.ts: invalidateQueries() names no known query                                                                                                                                                                                                                           |
| admin.savePolicy            |          1 | features/admin/model/reminders-tab-mutations.ts: invalidateQueries() names no known query                                                                                                                                                                                                                          |
| admin.removePolicy          |          1 | features/admin/model/reminders-tab-mutations.ts: invalidateQueries() names no known query                                                                                                                                                                                                                          |
| archive.archiveReport       |          1 | features/report-pages/ui/weekly/use-weekly-report-mutations.ts: invalidateQueries() names no known query                                                                                                                                                                                                           |
| archive.unarchiveReport     |          1 | features/report-pages/ui/weekly/use-weekly-report-mutations.ts: invalidateQueries() names no known query                                                                                                                                                                                                           |
| period.publish              |          3 | features/period/model/use-period-report-mutations.ts: invalidateQueries() names no known query                                                                                                                                                                                                                     |
| period.reopen               |          3 | features/period/model/use-period-report-mutations.ts: invalidateQueries() names no known query                                                                                                                                                                                                                     |
| leadForm.fillFrom           |          1 | features/period/model/use-lead-form-fill-from.ts: invalidateQueries() names no known query                                                                                                                                                                                                                         |
| leadForm.revoke             |          2 | features/dashboard/ui/revoke-lead-button.tsx: invalidateQueries() names no known query, cannot follow onMutated()                                                                                                                                                                                                  |
| leadForm.revokeAllSubmitted |          1 | features/dashboard/ui/use-dashboard-data.ts: invalidateQueries() names no known query                                                                                                                                                                                                                              |
| leadForm.requestReopen      |          1 | features/period/model/use-lead-form-reopen-request.ts: invalidateQueries() names no known query                                                                                                                                                                                                                    |

## ✓ Read-back wired

The evidence found on each success path.

| Procedure                    | Call sites | Evidence                                                                                                                                   |
| ---------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| dev.wipeAndReseed            |          1 | full page navigation (location.href)                                                                                                       |
| review.acknowledge           |          1 | invalidateQueries(review.acknowledgements)                                                                                                 |
| admin.saveStageAssignment    |          1 | invalidateQueries(admin.listStageAssignments), invalidateQueries(admin.listStageAssignmentCounts)                                          |
| admin.deleteStageAssignment  |          1 | invalidateQueries(admin.listStageAssignments), invalidateQueries(admin.listStageAssignmentCounts)                                          |
| admin.attachProductToGroup   |          1 | invalidateQueries(admin.listGroupProducts), invalidateQueries(admin.listProductGroupOwnership), invalidateQueries(admin.listProductGroups) |
| admin.detachProductFromGroup |          1 | invalidateQueries(admin.listGroupProducts), invalidateQueries(admin.listProductGroupOwnership), invalidateQueries(admin.listProductGroups) |
| admin.archivePeriod          |          1 | invalidateQueries(admin.listPeriodsByState)                                                                                                |
| admin.unarchivePeriod        |          1 | invalidateQueries(admin.listPeriodsByState)                                                                                                |
| admin.deleteReport           |          1 | invalidateQueries(admin.listPeriodsByState)                                                                                                |
| admin.createPeriodManual     |          1 | invalidateQueries(admin.listPeriodsByState)                                                                                                |
| admin.updatePeriodManual     |          1 | invalidateQueries(admin.listPeriodsByState)                                                                                                |
| admin.respondReopenRequest   |          2 | invalidateQueries(admin.listReopenRequests), invalidateQueries(admin.pendingReopenCount)                                                   |
| admin.jobs.retryFailed       |          1 | invalidateQueries(admin.jobs.listFailed), invalidateQueries(admin.dlqCount)                                                                |
| projectActivity.create       |          1 | invalidateQueries(projectActivity.list)                                                                                                    |
| projectActivity.update       |          1 | invalidateQueries(projectActivity.list)                                                                                                    |
| projectActivity.archive      |          1 | invalidateQueries(projectActivity.list)                                                                                                    |
| projectActivity.attachLead   |          1 | invalidateQueries(projectActivity.list)                                                                                                    |
| projectActivity.detachLead   |          1 | invalidateQueries(projectActivity.list)                                                                                                    |
