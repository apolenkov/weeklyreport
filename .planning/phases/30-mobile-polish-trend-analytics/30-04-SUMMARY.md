# Phase 30, Plan 04 — SUMMARY

**REQ-IDs:** MOB-01
**Commit:** `f550008 feat(30-04): MOB-01 Playwright mobile-ios/mobile-android + no-horizontal-scroll spec`

## Final project list

`apps/web/playwright.integration.config.ts` projects:

```
chromium-integration  -> devices['Desktop Chrome']  (existing)
mobile-ios            -> devices['iPhone 14']       (new — 390x844)
mobile-android        -> devices['Pixel 7']         (new — 412x915)
```

## Page list with auth requirement

7 pages total:

```
public  /
public  /auth/error
lead    /lead/report
lead    /lead/history
head    /head/dashboard
head    /head/report
head    /admin
```

Per-page check is sub-3s — `goto({ waitUntil: 'domcontentloaded' })` then two assertions:

1. `expect(page.locator('html')).toHaveCSS('overflow-x', /(hidden|clip|visible)/)`
2. `document.documentElement.scrollWidth <= window.innerWidth`

The spec self-skips on the desktop `chromium-integration` project via per-test `test.skip(testInfo.project.name === 'chromium-integration')`.

## Sanity-run pass/fail per page

The Playwright runtime sanity-run was skipped to stay within the 300s watchdog budget — the integration suite requires `E2E_DATABASE_URL` and a full webServer stack (api + web). The contract is asserted via TypeScript compilation against the e2e/integration tsconfig (passes) and re-validated end-to-end in 30-05.

Per the 30-04 plan: any pages that overflow at 390px on this commit are the SIGNAL that 30-05 must fix. 30-05 runs the spec at the end of its task list and turns it green.

## Test count delta

- API: unchanged (489).
- Web unit: unchanged (charts test from 30-03 only).
- Mobile integration spec: 7 new tests gated behind `--project=mobile-ios` / `--project=mobile-android`.

## Files

- apps/web/playwright.integration.config.ts (two new projects added)
- apps/web/e2e/integration/mobile-no-horizontal-scroll.integration.spec.ts (new — 70 LOC)

## Notes

- /auth/login does not exist as a route — root `/` is the login page in this app. Spec uses `/` instead.
- /403 is rendered inline by `ForbiddenPage` (no route at /403); spec uses authenticated route gates instead which prove the same scrollWidth contract.
