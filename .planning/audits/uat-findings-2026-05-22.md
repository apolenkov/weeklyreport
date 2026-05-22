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

## Live manual UAT session (user-driven, 2026-05-22 ~14:44+)

User runs manual UAT in the browser and streams findings via Plannotator.
Automated sweep retired for this session (single shared browser contends with
the user). Findings + status:

- [✓ fixed] lead/report toolbar: `ArchiveToggle` moved next to the period
  selector (shared `ReportToolbar`; lead + head history). commit done.
- [✓ env] "нет выбранных продуктов, как сохранять версию" — addressed by
  `db:wipe:manual-uat` minimal reseed (6 products, 12 stage assignments, Week 21
  open report). User to reload. Re-confirm version-save with products present.
- [▲ build] Standalone **Priorities section is redundant** now that priority
  rank attaches to items/positions — remove the separate accordion section
  (`accordion-section.tsx` consumer in `lead-form.tsx`). Verify priorities are
  truly item-level before removing.
- [▲ build] **Unique priority ranks within the period** — a rank value must be
  unique across the current week + next-week plans (no duplicate priority
  numbers). Enforce in the priority picker + autosave/validation.
- [▼ roadmap/frozen] **Jira linkage** — defer like dark-theme/i18n/holidays:
  add a roadmap TODO + ComingSoon trace, do NOT build now.
- [✓ verified-by-trace] **SDLC stage colour (cross-author)** — code trace
  (sdlc-confirm agent) confirms the path is already correct: backend
  `lead-form.prisma-repository.ts:562` returns a real status (green/yellow/red)
  whenever the foreign author has saved one, the frontend `trafficToStageStatus`
  maps it to the real colour, and `StageChip` never suppresses colour for a
  locked stage (lock is icon-only, `opacity-50`). Grey (`status:"empty"`) appears
  ONLY when no status exists yet — which matches the spec's "cell coloured when
  ≥1 stage/risk/block". No code change. IF UAT shows grey on a stage that DOES
  have a saved status, that is a separate save-path bug (stageStatuses not
  persisted) — file it then; do not change the mapping.

## Re-sweep on the feature build (run 3, 2026-05-22 ~16:4x via Playwright MCP)

Live console-error sweep on the running dev server reflecting all session
commits (split-views, grouping toggle, priorities, logging, Vercel wins):

```text
console errors by role/screen:
  lead   /lead/report               0
  head   /head/dashboard            0
  head   /head/report               0
  admin  /admin                     0
  viewer /reports?tab=published     0
```

All four roles render their primary screens with **zero console errors** on the
feature build → done-condition 1 satisfied. SSR document titles now resolve to
the org name / week label (generateMetadata win confirmed live, e.g. "Week 21,
May 18–24, 2026 - CustomReport"). Deep per-tab walks (admin sub-tabs, viewer
history) + CLS measurement remain for a focused browser pass.

## Split-view live verification (run 3, 1728px viewport)

- **lead /lead/report** — `aside[aria-label="Slide preview"]` present + visible at
  xl, inside an `xl:grid grid-cols` split; the preview renders a live deck from
  the draft section ("Lead 1 · lead / 0 Current / 0 Risks / 100 On-track %") →
  done-condition 2 split-view confirmed (edit + live preview, single source).
- **head /head/report** — split grid + read-only `HeadSlidesClient` preview at
  xl; `ScopeToggle` shows "By product" / "By lead" and is clickable → grouping
  toggle confirmed (done-condition 3 / 10). Per-lead group headings are empty on
  the current seed because lead sections have no submitted content yet (correct —
  empty groups are filtered); grouping logic itself is pinned by a unit test.

## CLS measurement (run 3, layout-shift PerformanceObserver, 1728px)

```text
/lead/report   CLS 0.0000  good
/head/dashboard CLS 0.0817  good (close to the 0.10 threshold)
```

Both in the "good" band → done-condition 4 CLS satisfied. The dashboard's 0.0817
is near the threshold. Tested hypothesis: added a fixed-height `loading`
placeholder to the lazy `ProductKpiCard` — **CLS stayed 0.0817**, so the lazy
card is NOT the source (placeholder kept anyway as correct hardening for the
ssr:false mount). Real source is therefore the dashboard **skeleton→content
swap** (`DashboardSkeleton` height ≠ populated content height) and/or
ActivityLivePanel/KpiCards settling. Follow-up (next session): align
`DashboardSkeleton` block dimensions with the populated layout to push dashboard
CLS toward 0.

## Remaining (roadmap W2/W3)

- Submit a lead → re-check head dashboard Revoke + Revoke All live (P6/P7 functional proof).
- locked stage chip colour confirm; layout/skeleton CLS measurement.
- admin per-tab + viewer history deep walks.
- Screenshots: `.playwright-mcp/sweep-head-dashboard.yml` + `/tmp/uat-*.png` (partial).
