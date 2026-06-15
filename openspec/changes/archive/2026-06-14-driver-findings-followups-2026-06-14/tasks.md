# Tasks — Driver-Findings Follow-ups (2026-06-14)

Resolved 2026-06-14 (ultracode autonomous, advisor-reviewed). Order followed the
proposal's recommendation: fix item 2 first, then item 1 (option A), then item 3.

## 2. Empty-PDF worker scope (bug, own change) — DONE FIRST

- [x] 2.1 The export render is now scoped to the REQUESTER. The token carries
      the requester's `userId` (`requestedBy`); `buildPdfExportSession` rebuilds
      that user's real session through the same `hydrateSession` pipeline a
      logged-in request uses, so head → full report, lead/viewer → their slice.
      `pdfExportGuard` stays role-independent (verified). Legacy tokens without
      `requestedBy` keep the narrow viewer session; a vanished requester fails
      closed. Tests: context head→full, viewer→scoped-non-empty (discriminating),
      fail-closed; integration asserts the token carries `requestedBy`. API
      typecheck + 908 unit + 99 integration green.

## 1. Viewer Export-PDF — RESOLVED option A

- [x] 1.1 Option A (grant the viewer Export-PDF), now safe because item 2 makes
      the viewer's export a non-empty scoped render. `pdfExport.request/.status`
      widened to `anyRoleProcedure`; the button shows for every authenticated
      role (`canExportPdf = currentRole !== null`). This satisfies the
      previously-failing `viewer-export-report-pdf` catalog oracle. Tests: the
      role-gated button suite now includes viewer; the viewer read-only test
      asserts Export-PDF present while period-mutation actions stay head/admin.

## 3. PeriodNavigator reach active-from-published (UX) — RESOLVED yes

- [x] 3.1 Yes — the active period is always present in the dropdown. The head
      shell fetches the current week separately (`weeklyReport.get({})`) and
      prepends it (deduped) alongside the displayed week, so the chevron can
      return to the current week from any published week. Test: from a
      published-week page the navigator listbox offers the current week as an
      option. web 1105 green.
