---
phase: 17-ui-redesign
status: open
date: 2026-05-08
source:
  - .planning/regression/evidence/2026-05-08-layout-empty-section-polish/layout-check.json
  - .planning/regression/evidence/2026-05-08-ui-security-guideline-pass/SUMMARY.md
  - .planning/regression/evidence/2026-05-08-phase16-17-uat/uat-live-results.json
  - .planning/quick/260508-kfo-layout-empty-section-polish/260508-kfo-SUMMARY.md
---

# Phase 17 UI Review: Consolidated Plan

## Scope

Review lenses used:

- frontend-design
- bencium-controlled-ux-designer
- ui-ux-pro-max design and ui-styling
- design-audit
- gsd-ui-review
- typography
- web-design-guidelines
- security-audit

Reviewed surfaces:

- /head/dashboard
- /head/report/[reportId]?authorId=...
- dashboard sections: Activity This Period, KPI cards, Blocked & At Risk, Lead Reports, Report Archive
- weekly report sections: Portfolio Overview, ProductAccordion list, PDF/publish controls
- navigation active states
- current evidence screenshots under .planning/regression/evidence/

## Scorecard

| Pillar              | Score | Current read                                                                                        |
| ------------------- | ----: | --------------------------------------------------------------------------------------------------- |
| Visual hierarchy    |   3/4 | Core structure is readable; canvas is still too flat and beige-heavy.                               |
| Spacing rhythm      |   3/4 | Header/body top gaps fixed for reviewed sections; needs tokenized contract.                         |
| Interaction states  |   3/4 | Empty accordions disabled; hover no longer shifts vertically; scope still needs full sweep.         |
| Domain clarity      |   2/4 | Product/report concepts are visible, but domain state rules are not fully encoded in UI/regression. |
| Accessibility       |   3/4 | Buttons, disabled states and focus rings mostly present; keyboard path needs replay by role.        |
| Security/logging UX |   2/4 | Access rules look server-enforced, but raw debug/error logging needs sanitization.                  |

## Findings

### P0 - Fixed in quick task 260508-kfo

- Empty Blocked & At Risk is muted and disabled.
- Empty weekly product accordions are muted and disabled.
- Header/body top gaps pass at 16px in dashboard and weekly report.
- Vertical hover movement removed from reviewed cards.
- Weekly Report nav is active on /head/report/[reportId].
- Archive nav no longer activates on /reports/trends.
- Toggle All is scoped to product accordions only.

Evidence: .planning/regression/evidence/2026-05-08-layout-empty-section-polish/layout-check.json.

### P1 - Design system polish needed

- The app background reads as one broad beige field. It needs a restrained work-surface system, not decorative blobs or marketing gradients.
- Cards and panels use similar white/border/shadow language everywhere, so primary vs secondary surfaces are not distinct enough.
- Empty states are now safer, but visual language should be shared across dashboard, weekly report, archive, admin, and forms.

### P1 - Domain UX rules not fully formalized

- Activity This Period should remain a live operational feed: who is active, submitted, stale, or pending.
- Lead Reports should remain a review/action grid: which lead report to open, status, route, and readiness.
- Product owner is not the reporting owner. Reporting should use SDLC stage assignments unless future notification logic explicitly uses product owner.
- Empty product with no report content should be non-expandable and visually muted.
- Product with content should be expandable and navigable from Portfolio Overview.

### P2 - Logging and safety gaps

- apps/api/src/infrastructure/trpc/trpc.middleware.ts logs raw rawInput at debug level. This can expose report text and identifiers if enabled outside local dev.
- Client error paths log raw Error plus ids/role/path in several places. Production UI should show a stable error code or correlation id, not raw backend messages.
- Future user action log should capture create/update/delete/publish/export/navigation-critical events without storing sensitive report text directly.

## Background Direction

Preferred direction: Operational Ledger.

- Keep the app utilitarian and dense.
- Replace one-note beige with layered neutral surfaces:
  - canvas: cool off-white/green-gray base.
  - work-band: subtle full-width sections for major vertical groups.
  - card: white or near-white with consistent border.
  - muted: gray-green empty state.
- Add a very subtle grid or ruled-paper texture only if contrast stays low and screenshots remain calm.
- Use accent colors only for semantic state: green, gold, red, blue/purple for SDLC labels.
- Do not add orbs, bokeh, decorative gradients, nested cards, or landing-page styling.

Alternative directions rejected for now:

- Marketing/hero style: wrong for repeated operational work.
- Heavy dark mode first: larger accessibility and token scope.
- Decorative gradient mesh: conflicts with the app reporting/productivity tone.

## Implementation Plan

### Batch 1 - Token and surface contract

- Add shared surface tokens for canvas, work-band, card, muted-card, border, focus, hover.
- Apply to dashboard, weekly report, reports archive, and admin shell.
- Keep all page sections unframed/full-width or single-level cards; no cards inside cards.

### Batch 2 - Empty and disabled state contract

- Create one rule for empty panels: muted, disabled, aria-expanded=false, no chevron affordance unless expandable.
- Apply across Blocked & At Risk, Lead Reports, Report Archive, Portfolio Overview, ProductAccordion, and admin empty tables.
- Add tests for disabled, aria-disabled, aria-expanded, cursor and no body render.

### Batch 3 - Domain regression matrix

- Build role x domain scenario matrix:
  - roles: lead, head, admin, viewer.
  - domain: departments, users, products, SDLC assignments, periods, lead reports, current/next items, risks, decisions, priorities, PDF, archive, reminders, activity, audit log.
- Convert current manual scenarios into Playwright specs with screenshots and console/network capture.
- Use separate browser contexts per role and wipe mode before every scenario.

### Batch 4 - Error/log telemetry

- Replace raw debug payload logging with redacted input metadata.
- Add correlation id to API/client errors.
- Add structured events for key user actions: report edit, item add/update/delete, risk add/update/delete, decision add/update/delete, publish, reopen, PDF export, admin mutation.
- Add an operator-visible log/audit screen only after storage schema is agreed.

### Batch 5 - Formal UI review closure

- Run gsd-ui-review after Batch 1-4.
- Update 17-UAT.md only per proven scenario.
- Do not mark Phase 16 PDF/theme gaps closed from this UI polish pass.

## Applied Safe Fixes 2026-05-08

| Area              | Change                                                                                                                          | Evidence                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| API object access | reports.saveDraft and reports.submit now pass ctx.session.userId and reject edits for another author's ReportSection.           | api test 57 files / 656 tests PASS                              |
| API object access | leadForm.versions now loads the section and rejects another author's version history.                                           | focused report-sections tests PASS                              |
| API object access | pdfExport.status is headProcedure and checks requestedBy against the export job owner; cross-user job lookup returns not found. | pdf-export tests PASS                                           |
| Logging           | tRPC debug logging records inputShape, not raw report/admin/user input.                                                         | static grep: inputShape present, rawInput value logging removed |
| Web guideline     | reports tab clicks now update /reports?tab=... so nav/deep-link state stays consistent.                                         | web lint/typecheck/test PASS                                    |
| Motion/a11y       | empty stage pulse now has motion-reduce:animate-none.                                                                           | web lint PASS                                                   |
| UI stability      | transition-all removed from apps/web/src.                                                                                       | static grep: 0 matches                                          |
| Typography        | visible loading/search ellipses use the single ellipsis character.                                                              | web lint/typecheck/test PASS                                    |
| Live UAT          | phase 17 live replay now covers all 10 original UAT scenarios against localhost:3000/3002.                                      | 10 PASS, 0 FAIL, 2 phase16 BLOCKED                              |
| Landing           | / in dev stub mode stays on the landing entry surface instead of treating backend DEV_SESSION fallback as explicit login.       | sc-17-01-login.png                                              |
| URL history       | Reports tab switches use browser history so Back returns from Published to My Drafts.                                           | sc-17-10-url-routing.png                                        |

Verification run:

| Command                                                | Result                    |
| ------------------------------------------------------ | ------------------------- |
| rtk proxy pnpm --filter @customreport/api typecheck    | PASS                      |
| rtk proxy pnpm --filter @customreport/web typecheck    | PASS                      |
| rtk proxy pnpm --filter @customreport/api lint         | PASS                      |
| rtk proxy pnpm --filter @customreport/web lint         | PASS                      |
| rtk proxy pnpm --filter @customreport/api test         | PASS, 57 files, 656 tests |
| rtk proxy pnpm --filter @customreport/web test         | PASS, 35 files, 277 tests |
| focused vitest: report-sections, lead-form, pdf-export | PASS, 5 files, 102 tests  |
| rtk proxy pnpm run typecheck                           | PASS, turbo root          |
| rtk proxy pnpm run lint                                | PASS, turbo root          |
| rtk proxy pnpm run test                                | PASS, turbo root          |
| rtk proxy pnpm run doctor                              | PASS                      |
| rtk proxy graphify update .                            | PASS                      |

Still not closed by this pass:

- Background/surface token batch is still a design-system task.
- Correlation-id UX, client error sanitization, and persistent user action log are still planned work.
- Phase 16 PDF/theme human UAT remains open.

## Verification Plan

- rtk proxy pnpm --filter @customreport/web lint
- rtk proxy pnpm --filter @customreport/web typecheck
- rtk pnpm --filter @customreport/web test
- rtk pnpm --filter @customreport/web exec playwright test --config=playwright.integration.config.ts
- Browser screenshot pass for desktop and mobile:
  - /head/dashboard
  - /head/report/[reportId]?authorId=...
  - /lead/report
  - /reports?tab=drafts
  - /reports?tab=published
  - /admin?tab=users
  - /admin?tab=settings
- Evidence target: .planning/regression/evidence/<date>-ui-review/

## Status

- This review is a plan and evidence index.
- It does not close 17-UAT.md.
- It does not close Phase 16 PDF/theme human UAT.
