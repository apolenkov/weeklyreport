---
date: 2026-05-08
scope: ui-security-guideline-pass
status: pass-with-remaining-uat
---

# UI/Security Guideline Pass

## Inputs

- Skills/lenses: frontend-design, bencium-controlled-ux-designer, ui-ux-pro-max, design-audit, gsd-ui-review, security-audit, typography, web-design-guidelines.
- Evidence base: screenshots and layout evidence from 2026-05-08 manual UAT and layout-empty-section-polish pass.
- Fresh guideline check: Vercel web-interface-guidelines.

## Fixed

| Gap                            | Files                                                                                                            | Result                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Raw tRPC input debug logging   | apps/api/src/infrastructure/trpc/trpc.middleware.ts                                                              | Logs inputShape only.                                        |
| Foreign ReportSection mutation | apps/api/src/modules/report-sections/report-sections.service.ts, apps/api/src/infrastructure/trpc/trpc.router.ts | saveDraft/submit require ctx.session.userId owner match.     |
| Foreign lead version history   | apps/api/src/modules/report-sections/lead-form.service.ts, apps/api/src/infrastructure/trpc/trpc.router.ts       | leadForm.versions owner-only.                                |
| Foreign PDF job status         | apps/api/src/modules/pdf-export/\*, apps/api/src/infrastructure/trpc/trpc.router.ts                              | status is head-only and requestedBy-bound.                   |
| Reports tab local-only state   | apps/web/src/app/(app)/reports/page.tsx                                                                          | Clicks update /reports?tab=... .                             |
| Reduced-motion gap             | apps/web/src/components/lead/stage-chip.tsx                                                                      | motion-reduce disables pulse.                                |
| transition-all sweep           | apps/web/src                                                                                                     | 0 matches after patch.                                       |
| Visible triple-dot ellipses    | apps/web/src                                                                                                     | Replaced touched loading/search labels with single ellipsis. |

## Verification

| Command                                                                                                                                                                                                                                                                                                                                                                                             | Result                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| rtk proxy pnpm --filter @customreport/api typecheck                                                                                                                                                                                                                                                                                                                                                 | PASS                      |
| rtk proxy pnpm --filter @customreport/web typecheck                                                                                                                                                                                                                                                                                                                                                 | PASS                      |
| rtk proxy pnpm --filter @customreport/api lint                                                                                                                                                                                                                                                                                                                                                      | PASS                      |
| rtk proxy pnpm --filter @customreport/web lint                                                                                                                                                                                                                                                                                                                                                      | PASS                      |
| rtk proxy pnpm --filter @customreport/api test                                                                                                                                                                                                                                                                                                                                                      | PASS, 57 files, 656 tests |
| rtk proxy pnpm --filter @customreport/web test                                                                                                                                                                                                                                                                                                                                                      | PASS, 35 files, 277 tests |
| rtk proxy pnpm --filter @customreport/api exec vitest run src/modules/report-sections/report-sections.service.test.ts src/modules/report-sections/lead-form.contract.test.ts src/modules/report-sections/version-history.integration.test.ts src/modules/pdf-export/pdf-export.service.test.ts src/modules/pdf-export/pdf-export.contract.test.ts src/infrastructure/trpc/trpc.error-mapper.test.ts | PASS, 5 files, 102 tests  |
| rtk proxy pnpm run typecheck                                                                                                                                                                                                                                                                                                                                                                        | PASS, turbo root          |
| rtk proxy pnpm run lint                                                                                                                                                                                                                                                                                                                                                                             | PASS, turbo root          |
| rtk proxy pnpm run test                                                                                                                                                                                                                                                                                                                                                                             | PASS, turbo root          |
| rtk proxy pnpm run doctor                                                                                                                                                                                                                                                                                                                                                                           | PASS                      |
| rtk proxy graphify update .                                                                                                                                                                                                                                                                                                                                                                         | PASS                      |

## Remaining

- Run live Playwright role-matrix on the dev stack before product-ready closure.
- Implement shared surface/background tokens and re-run screenshot diff.
- Add correlation ids and persistent user action log storage/UI.
- Decide whether report-section service should require actorUserId for every non-test caller; current API surface is enforced, legacy direct service callers remain backward-compatible.
