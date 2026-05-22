<!-- markdownlint-disable MD013 -->

# UAT findings — multi-role sweep (2026-05-22)

Live sweep on the FRESH dev server (post stale-server restart) via Playwright
MCP + CLI dev-login. Roles: lead / head / admin / viewer.

## Summary

```text
console errors by role (main screen):  lead 0 · head 0 · admin 0 · viewer 0
```

All four roles' primary screens render with **zero console errors** on the
fresh build — confirms the app is in a healthy working state after the
stale-server restart (the prior "broken/grey" was the dead bundle).

## Per-role results

### lead — /lead/report/…001

- ✓ Page renders (52 KB, no "No QueryClient" SSR crash).
- ✓ priorityRank persists across reload (priorities section shows the rank).
- ✓ priorityRank dialog re-populate fixed (read-path `mapLeadItems`, commit a96c44e).
- ◻ locked stage chip colour (Борис С / Planning): re-confirm visually on fresh build (was likely stale-server grey).
- ◻ layout jump / skeleton: needs CLS measurement (W2).

### head — /head/dashboard

- ✓ 0 console errors. Renders: Dashboard, Submission Activity, Period Summary, Product KPIs.
- ▼ Revoke / Revoke All buttons (P6/P7) NOT visible in current state — they are
  conditional (`status === "submitted"` rows / `submittedCount > 0`). Current
  period has no submitted leads ("Blocked & At Risk 0 issues"), so hidden by
  design. NEXT: seed/submit a lead section to confirm the buttons render + work live.

### admin — /admin

- ✓ 0 console errors. /admin renders (tabs present).
- ◻ per-tab deep walk (users/products/periods/reminders/integrations/jobs) — not yet exhaustively checked.

### viewer — /reports?tab=published

- ✓ 0 console errors. Reports list renders.
- ◻ /reports/history deep walk — not yet checked.

## Notes / non-issues

- Dev overlays in snapshots (Next.js Dev Tools, Plannotator MCP panel) are not app problems.
- 2 warnings on head dashboard (non-error) — low priority, not investigated.

## Remaining (roadmap W2/W3)

- Submit a lead → re-check head dashboard Revoke + Revoke All live (P6/P7 functional proof).
- locked stage chip colour confirm; layout/skeleton CLS measurement.
- admin per-tab + viewer history deep walks.
- Screenshots: `.playwright-mcp/sweep-head-dashboard.yml` + `/tmp/uat-*.png` (partial).
