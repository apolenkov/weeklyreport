---
status: in_progress
quick_id: 260509-gbi
created: 2026-05-09T08:45:01Z
---

# Quick Task 260509-gbi: Phase 16 PDF UAT Fixture Closure

## Goal

Close the remaining Phase 16 PDF runtime UAT honestly against the live Docker
stack without reseeding or destructively publishing the active report.

## Plan

1. Make apps/web/e2e/regression/phase16-17-uat.spec.ts create a temporary
   published report only when no published report exists.
2. Require pdfExport.status to reach completed within 30 seconds.
3. Clean up the temporary report and its PDF job rows after the scenario.
4. Run the focused Playwright UAT against localhost:3000 and localhost:3002.
5. Update Phase 16 planning evidence only from the resulting live proof.

## Guardrails

- Do not run pnpm db:seed:simple; it wipes data.
- Do not publish the active live report as a shortcut.
- Keep the retired theme-toggle scenario explicit as a product decision, not a
  hidden skip.
