# Tasks — Driver-Findings Follow-ups (2026-06-14)

Capture only. Each item needs a decision or its own grilled plan before code.

## 1. Viewer Export-PDF (decision)

- [ ] 1.1 User decides: grant viewer Export-PDF (option A) OR deprecate the
      `viewer-export-report-pdf` catalog intent (option B). Resolve item 2 first.

## 2. Empty-PDF worker scope (bug, own change)

- [ ] 2.1 Grilled plan: make the export worker session carry the requester's
      group scope (or an all-access export role) so the PDF is not empty. Add a
      test that a head/lead export renders non-zero sections.

## 3. PeriodNavigator reach active-from-published (UX, low priority)

- [ ] 3.1 Decide whether the active period should always be present in the
      dropdown (so the chevron can return to it from any published week).
