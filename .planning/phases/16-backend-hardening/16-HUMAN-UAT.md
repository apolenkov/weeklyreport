---
status: partial
phase: 16-backend-hardening
source: [16-VERIFICATION.md]
started: 2026-04-21T20:30:00+03:00
updated: 2026-05-08T16:23:00+03:00
evidence:
  - .planning/regression/evidence/2026-05-08-phase16-17-uat/uat-live-results.json
  - apps/web/e2e/regression/phase16-17-uat.spec.ts
owners:
  pdf_export_runtime: product/UAT operator approval to publish or reseed a report
  theme_toggle_visual: product decision to restore/build or retire the theme toggle scenario
---

## Current Test

[blocked on live preconditions; do not mark PASS]

## Tests

### 1. BullMQ PDF Export End-to-End

expected: Start API with Redis running, trigger PDF export from browser. Job transitions from queued to completed within 30 seconds.
result: [blocked] Live stack is healthy, but the current live DB has only one draft/open report and no published report. PDF runtime UAT requires either a published report or explicit reseed/publish approval.

### 2. Theme Toggle Visual Behavior

expected: Click Moon/Sun icon in nav-user dropdown. Dark/light theme toggles without FOUC flash. System preference detection works on first load.
result: [blocked] Current product build has no theme toggle surface. Product decision required before visual behavior can be tested.

## Summary

total: 2
passed: 0
issues: 0
pending: 0
skipped: 0
blocked: 2

## Gaps

- PDF export runtime: need a published report in live DB, or explicit permission to reseed/publish a report for UAT.
- Theme toggle: need product decision to restore/build a theme toggle surface, or retire this stale scenario from phase 16.
