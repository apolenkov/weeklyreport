# 08-head-dashboard — UAT Scenarios

**Route:** `/head/dashboard` | `/dashboard`
**Role:** head / admin (viewer reads-only in future phases)

Combines submission metrics, real-time activity feed, risk tracking, KPI analytics, and archive browsing into a single operations hub.

## Dashboard Page Structure

### DASH-01 — Page loads with all sections when period is open

**Element:** `<main id="main-content">`
**Route:** `/head/dashboard`
**Role:** head
**State precondition:** Active reporting period with at least one lead

Steps:

1. Navigate to `/head/dashboard` as head.
2. Wait for page settle.

Expected: Renders in order: header → activity panel → KPI cards → product-KPI → alert bar → blocked/at-risk → archive. No skeletons after settle.
Edge cases:

- Period published → activity panel: "Period published; activity is not tracked".
- No active period (R3a) → empty state "No active reporting period…".
- User deactivated (UFB-001) → endpoints 403, error toast.
- Data stalls >8s (DASHBOARD_LOAD_STALL_MS) → retry UI replaces content.

Status: `[ ]`

### DASH-02 — Header shows period label and organization name

**Element:** `<h1>Dashboard</h1>` + subtitle
**Role:** head

Expected: Title "Dashboard", subtitle "Week 16 · {org.fullName}".
Edge cases:

- No period → no subtitle period info.
- orgFullName=null → "CustomReport" fallback.

Status: `[ ]`

### DASH-03 — View Status Report button links to /head/report/<reportId>

**Element:** `<a href="/head/report/[reportId]">View Status Report</a>`

Steps: Click button → `/head/report/{reportId}`.

Edge cases:

- reportId with special chars → URI-encoded.

Status: `[ ]`

### DASH-04 — Activity Live Panel shows all leads' submission statuses

**Element:** `<section aria-labelledby="activity-live-heading">`

Expected: One row per lead with "Draft"/"Submitted" pill, initials avatar, counts (items/risks/decisions/priorities), relative time ("2h ago"). Empty leads → "No content" muted pill.
Edge cases:

- No leads started → "Leads have not started…".
- Period published → "Period published; activity is not tracked".
- Last edit >7d → full date displayed.

Status: `[ ]`

### DASH-05 — Activity row links to detailed report filtered by lead

**Element:** `<a href="/head/report/{reportId}?authorId={leadId}">`

Expected: Click → opens report scoped to that lead. Lead with no content → non-interactive, muted.

Status: `[ ]`

### DASH-06 — Submissions KPI card shows submitted/total and pending count

**Element:** `aria-label="Submissions: X of Y, Z pending"` | conic-gradient ring

Expected: Ring "submitted/total" (e.g. "4/6"). Below: "Last week: X/Y". If pending>0, amber "N pending" badge.
Edge cases:

- All submitted → no pending badge.
- submissionPercent=100% → solid green ring.

Status: `[ ]`

### DASH-07 — Deadline KPI card shows countdown timer

**Element:** `aria-label="Deadline: ..."` | gold text

Expected: 32px deadlineLabel ("2d 5h"). Subtle deadlineTime ("Friday 18:00").
Edge cases:

- Deadline passed → "OVERDUE" or "0d 0h".
- No deadline → "TBD" placeholder.

Status: `[ ]`

### DASH-08 — Risks & Blockers KPI card shows counts

Expected: Three columns: blockedCount (red), atRiskCount (gold), decisionCount (primary-blue). Labels: Blocked / At Risk / Decisions.

Status: `[ ]`

### DASH-09 — Product KPI card renders for head/admin/viewer/director roles

**Element:** `data-testid="product-kpi-card"`
**Role:** head, admin, viewer, director

Expected: 6 stat boxes (Reports this period, On-time ratio, Active leads, Late sections, Pending reopens, PDF exports 7d) + sparkline if data.
Edge cases:

- Lead role → renders null (gated by isLeadership).
- summaryQ.isLoading → "Loading telemetry…".
- summaryQ.isError → "Не удалось загрузить телеметрию".
- onTimeRatio=null → "—".

Status: `[ ]`

### DASH-10 — Product KPI chart shows 4-week sparkline

**Element:** `<LineChart>` aria-label "On-time ratio sparkline over the last 4 periods"

Expected: 4 data points, y-axis [0,100], green line (#00754A), tooltip on hover.
Edge cases:

- sparklineRows=[] → chart not rendered.
- sparklineRows.length<4 → renders available points.

Status: `[ ]`

### DASH-11 — Alert Bar shows when leads are pending

Steps: pendingLeads>0, period not published.

Expected: Warning icon, text listing pending lead names with status, "Send Reminder" button.
Edge cases:

- pendingLeads=[] → renders null.
- Period published → button disabled, title "Active reminder policy required".
- No active reminder rule → disabled, toast "Configure it in Admin → Reminders".

Status: `[ ]`

### DASH-12 — Send Reminder button dispatches reminders

**Element:** `<button>Send Reminder</button>`

Expected: Button "Sending…", disabled during call. Toast success ("Reminder sent to 2 leads.") or info ("All 2 already received this cycle's reminder.").
Edge cases:

- dispatched=0, alreadySent=2 → "All 2 already received".
- dispatched=2, skipped=1 → "Reminder sent to 2 leads (1 opted out)".
- Network error → "Failed to send reminder".

Status: `[ ]`

### DASH-13 — Blocked & At Risk table expands and collapses

**Element:** `<button aria-expanded>`

Expected: Header icon + label + count badge. Expanded (default if hasItems) shows details grid. Collapsed → grid-template-rows: 0fr.
Edge cases:

- items=[] → button disabled, aria-disabled=true.

Status: `[ ]`

### DASH-14 — Blocked & At Risk items display product, stage, assignee, description

Expected: severity badge (Blocked red / At Risk amber), bold "{product} · {stage}", gray "· {assignee}", description below.

Status: `[ ]`

### DASH-15 — Report Archive loads with cursor pagination

Expected: Heading "Report Archive" + count "12 loaded+". Grid sm:grid-cols-2 lg:grid-cols-4, 12 cards/page.
Edge cases:

- archive.isLoading → "Loading…".
- reports=[] → "No archived reports yet.".
- hasNextPage=false → "Load more" hidden.

Status: `[ ]`

### DASH-16 — Archive cards show status badge and link to correct report

Expected: Active report (id===currentReportId) → green left border, "Active" badge, link `/head/report/{id}`. Published → blue "Published". Draft → amber "Draft", link `/reports/{id}`.

Status: `[ ]`

### DASH-17 — Load more button fetches next page of archive

**Element:** `<button onClick={archive.fetchNextPage}>Load more</button>`

Expected: "Loading…" disabled state. New cards append. Disappears at end.

Status: `[ ]`

### DASH-18 — Dashboard recovers from bfcache after browser back-forward

**Element:** bfcache recovery script | `data-dashboard-loading="true"`

Expected: If stale (data-dashboard-loading=true), reload. Else queries refetch silently.

Status: `[M]`

### DASH-19 — Dashboard handles missing active period (R3a)

**State precondition:** weeklyQ.data.status === "no-period"

Expected: Empty state (no skeleton/toast): "No active reporting period" + "Ask an admin to open a new period…".

Status: `[ ]`

### DASH-20 — Dashboard shows retry UI on query error

**Element:** `<section role="alert">` + Retry button

Expected: Title "Could not load dashboard", description with error detail, Retry button → refetchDashboardQueries().
Edge cases:

- review.dashboard fails → "review failed" in description.
- archive.list fails → "archive failed".
- weeklyReport.get fails → "status report failed".

Status: `[ ]`

### DASH-21 — Dashboard logs stall and retries after 8 seconds

**Element:** Stall detection (DASHBOARD_LOAD_STALL_MS=8000)

Expected: logClientError("dashboard.load_stalled"). "Dashboard is still loading" alert. Queries refetch.

Status: `[M]`

### DASH-22 — All sections visible in correct order

Expected: header → activity → KPI cards → product KPI → alert bar (if pendingLeads) → blocked/at-risk → archive.

Status: `[ ]`

### DASH-23 — Responsive layout on mobile

**Viewport:** 375px / 768px / 1024px

Expected: 375px stack vertically; 768px KPI 3 cols; 1024px product KPI 6 cols, archive 4 cols.

Status: `[M]`

### DASH-24 — Error messages are user-friendly

Expected: formatClientErrorMessage(prefix + error.message). "Failed to load dashboard: …".

Status: `[ ]`

### DASH-25 — Scope filter for group-based dashboards (future phase)

**State precondition:** multiple groups, head role

Expected: Scope selector re-fetches data filtered by group. All sections update.

Status: `[S]` (deferred to Phase 50+; scope-filter not yet implemented)
