# Phase 16/17 Live UAT Evidence - 2026-05-08

web: http://localhost:3000
api: http://localhost:3002

Command:

    rtk proxy pnpm --filter @customreport/web exec playwright test --config=playwright.regression.config.ts e2e/regression/phase16-17-uat.spec.ts --project=chromium

Result:

- phase 17: 10 PASS / 0 FAIL
- phase 16: 0 PASS / 0 FAIL / 2 BLOCKED
- browser logs: 0 page errors, 0 5xx responses, 0 unexpected request failures

Phase 17 fixes verified:

- / in dev stub mode stays on the landing entry surface instead of auto-entering the backend DEV_SESSION fallback.
- /reports tab changes use browser history; Back returns from Published to My Drafts.
- Admin users tab and mobile Admin tab select are both visible and addressable.
- Navigation active state has exactly one active link for drafts, published, dashboard, and weekly report routes.

Phase 16 blockers preserved:

- PDF export runtime needs a published report or explicit reseed/publish approval.
- Theme toggle UAT needs product decision because the current UI has no theme toggle surface.
