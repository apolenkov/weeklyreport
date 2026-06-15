# Driver-Findings Follow-ups (2026-06-14)

## Why

The archived `driver-findings-2026-06-11` run surfaced three issues that are
out of its scope (pre-existing bugs or product decisions). Captured here so they
are not lost. NONE were auto-fixed — each needs a decision or its own
investigation.

## Items

### 1. Viewer Export-PDF — decision needed (DO NOT auto-resolve)

Finding 3 gave LEADS an Export-PDF control. The viewer was left as-is (it keeps
its `/print/<id>` link). But the catalog intent `e2e/catalog/viewer.yaml:53-58`
(`viewer-export-report-pdf`) still expects an Export-PDF button for the viewer,
so that oracle now FAILS.

Two options, **for the user**:

- **A. Grant the viewer an Export-PDF button** (consistent with leads; satisfies
  the oracle). BUT see item 2 — the export currently renders EMPTY for a
  no-group synthetic session, so the button may produce a blank PDF until item 2
  is fixed.
- **B. Deprecate the `viewer-export-report-pdf` catalog intent** as stale (viewer
  keeps Print only).

Recommendation: resolve item 2 first, then choose A. Until then, neither is
auto-applied.

### 2. PDF worker renders an EMPTY report (pre-existing, ALL roles)

The PDF worker navigates `/print/<id>` under a synthetic `role:viewer` session
with NO `viewerGroupAccess`. `weeklyReport.get` group-scopes the published
snapshot via `filterSnapshotSections`; a no-access viewer yields
`{id:{in:[]}}` → zero sections → an EMPTY render. This affects head/admin/lead
exports too (the worker session, not the requester, drives scope). Out of scope
for finding 3 (which only added the lead button + authz).

Needs its own change: the worker session must carry the REQUESTER's scope (or an
all-access export role) so the rendered PDF matches what the requester sees.
Regression-heavy (touches the export worker + session synthesis) — grilled plan
first.

### 3. PeriodNavigator — cannot chevron back to the active week from a published one

Also pre-existing (true before finding 4). The active period is only prepended
to `periods` when you are ON the active page, so from a PUBLISHED week the active
week is absent from the dropdown and the chevron cannot reach it. Finding 4's
acceptance (trigger shows the displayed period on `/head/report/<activeId>`) is
met; this navigation wrinkle is separate. Low priority UX.

## Notes

- Role-coverage-gate count moved 8→9 (a new `leadHeadAdminProcedure` builder) in
  the archived change; the gate spec sanctions this and `openspec validate` is
  green — flagged for awareness, not action.
- Toast text on malformed `/print` `/lead` `/head` ids could not be
  pixel-captured (sonner auto-dismiss vs Playwright poll); verified via the
  unit-tested pure formatter instead. A human glance at the toast on
  `/head/report/not-a-uuid` is the final confirmation.

## Out of Scope

- Auto-fixing any of the above tonight. This is a capture for the user's
  morning triage.
