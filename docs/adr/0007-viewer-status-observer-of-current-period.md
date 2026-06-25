# Viewer is a status observer of the current period (sees live content, drafts included)

**Status:** accepted

## Context

The `viewer` role was scoped to PUBLISHED reports only. The server gate
(`weekly-report.service.ts`: `role === "viewer" && periodStatus !== "published"
→ not-found`) rejected any non-published period, the primary nav entry resolved
`reports.latestPublished` (latest period with `periodStatus = "published"`), and
`viewer-published-search` restricted search to published content. This model was
captured in the now-archived change `2026-06-24-viewer-report-surface-parity`
("change B") and the `head-report-visibility` requirement "Viewer visibility
stays published-only".

That model has a hole that surfaced in live review: a lead submits their section,
but the viewer sees nothing, because a submitted section is not a published
period. The period only becomes visible to the viewer once the head publishes the
whole report — long after the status it represents is real. A viewer who is meant
to track "where do things stand this week" was blind to the current week until it
was already history.

## Decision

The viewer is a **status observer of the Current period**, not a consumer of
published reports.

- A single source of truth, `currentEditableId`, anchors both the entry and the
  gate: the global newest **non-archived** `open` / `reopened` report with
  `periodStart <= now` — editable-only, with NO published fallback. (It is exposed
  once via the repository / `WeeklyReportService` and called from both paths, never
  re-queried inline.)
- The viewer's primary entry (renamed "Latest" → "Status") resolves to the
  **Status target**: `currentEditableId` when that exact report has a viewer-visible
  section; otherwise the newest viewer-visible `published` report (group-scoped — the
  newest _visible_ published, not the globally newest); else the empty state. A new
  `reports.latestForViewer` resolver replaces `reports.latestPublished`. It does NOT
  search older editable periods, because the gate authorizes only `currentEditableId`.
- The published-only read gate is **replaced, not removed**, by a
  published-or-current gate: a viewer may read a report iff
  `periodStatus === "published"` **OR** `resolvedId === currentEditableId`; every
  other period (non-current `open` / `reopened`, archived-open, scheduled-future) is
  rejected. `currentEditableId` is resolved no earlier than the report fetch, so an
  `open → published` race rejects rather than serving a stale live model
  (fail-closed). Because "current" is the newest editable period, two concurrent
  `open` periods resolve deterministically — so this change does NOT depend on the
  deferred period-creation-lock. Determinism requires a TOTAL order: two
  concurrent editable periods can share a `periodStart`, so `currentEditableId`
  orders by `periodStart desc` **then `id desc`** (a stable tiebreak over the
  unique key). Without it a tie would let the gate and the entry resolver — which
  call the helper separately — pick different periods, 404-ing the viewer's own
  Status entry.
- On the period it is allowed to read, the viewer sees the **same report content
  the head sees on the current period**, including unsubmitted DRAFT sections.
  Visibility stays scoped to the viewer's `ViewerGroupAccess` groups (unchanged
  `groupScopeFilter`) and strictly read-only (no edit / submit / publish /
  lifecycle control).
- A `reopened` period therefore shows its live content (reopen marks sections
  `draft` but does not delete their text), so a previously-published report does
  not blank out while the head revises it.
- Search stays **published-scoped** (`viewer-published-search` unchanged): a live
  submitted record is readable before it is searchable. This read/search
  divergence is an accepted v1 limitation, documented in the spec.

This reverses change B and removes the `head-report-visibility` requirement
"Viewer visibility stays published-only".

## The one non-obvious consequence — viewers see unsubmitted drafts

Because the viewer now reads the same live model as the head, a viewer sees a
co-group lead's **unreviewed, half-finished draft** the moment it exists — there
is no submission or publish gate in front of it. This was a deliberate
simplicity-over-privacy call for the MVP: the alternative (filter the read model
to submitted-only, and reconcile that against the frozen `publishedSnapshot`,
which itself already contains whatever drafts existed at publish time) adds a
read-path branch and a published-vs-live asymmetry for marginal benefit at this
stage. Tightening viewer privacy (hide unsubmitted drafts) is a recognised
follow-up, not part of this change.

## Considered alternatives

- **Submitted-only live read** (viewer sees only submitted sections + an
  "X / N submitted" status, drafts hidden). Rejected for v1: it requires a
  `submittedAt` filter on the live read AND a matching filter on the
  `publishedSnapshot` (which freezes unsubmitted content at publish), plus
  snapshot-sticky handling on `reopened` to avoid the report blanking — real
  complexity the user explicitly declined ("don't overcomplicate; show it like
  the head, drafts included"). Kept as a privacy follow-up.
- **Keep published-only, just surface submission status** (a counter without
  content). Rejected: it does not fix the core gap — the viewer still cannot see
  the actual current content a lead has produced this week.
- **Make search live too.** Deferred: `viewer-published-search` carries its own
  snapshot/published assumptions; widening it is a separate surface. The v1
  divergence (live read, published search) is documented instead.
