# Viewer is a status observer of the current period

**Date:** 2026-06-25

**Status:** accepted

## Context

The `viewer` role was scoped to PUBLISHED reports only. The server gate
(`weekly-report.service.ts`: `role === "viewer" && periodStatus !== "published"
→ not-found`) rejected any non-published period, the primary nav entry resolved
only a published period, and `viewer-published-search` restricted search to
published content.

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
  newest _visible_ published, not the globally newest); else the empty state. A
  dedicated viewer-status resolver provides this target. It does NOT
  search older editable periods, because the gate authorizes only `currentEditableId`.
- The published-only read gate is **replaced, not removed**, by a
  published-or-current gate: a viewer may read a report iff
  `periodStatus === "published"` **OR** `resolvedId === currentEditableId`; every
  other period (non-current `open` / `reopened`, archived-open, scheduled-future) is
  rejected. `currentEditableId` is resolved no earlier than the report fetch, so an
  `open → published` race rejects rather than serving a stale live model
  (fail-closed). Because "current" is the newest editable period, two concurrent
  `open` periods resolve deterministically without relying on a separate creation
  lock for authorization correctness. Determinism requires a TOTAL order: two
  concurrent editable periods can share a `periodStart`, so `currentEditableId`
  orders by `periodStart desc` **then `id desc`** (a stable tiebreak over the
  unique key). Without it a tie would let the gate and the entry resolver — which
  call the helper separately — pick different periods, 404-ing the viewer's own
  Status entry. For the same reason, when a viewer calls the read with NO explicit
  `reportId` the default is resolved from `getCurrentEditableId` (else the newest
  published), not from an older active-period lookup — that path could resolve a
  default the gate then rejects.
- On the period it is allowed to read, the viewer sees the **same report content
  the head sees on the current period**, with submitted sections shown by
  default. The viewer may explicitly choose Show all to reveal authorized draft
  sections; this control applies only to the live Current period.
  Visibility stays scoped to the viewer's `ViewerGroupAccess` groups (unchanged
  `groupScopeFilter`) and strictly read-only (no edit / submit / publish /
  lifecycle control).
- A `reopened` period therefore shows its live content (reopen marks sections
  `draft` but does not delete their text), so a previously-published report does
  not blank out while the head revises it.
- Search stays **published-scoped** (`viewer-published-search` unchanged): a live
  submitted record is readable before it is searchable. This read/search
  divergence is an accepted v1 limitation, documented in the spec.

This decision supersedes published-only access for the Viewer Status surface.

## Submission-state boundary

The live Current period defaults to submitted sections for both head and viewer.
Show all is an explicit presentation control for authorized live sections only;
it never changes authorization or filters a published snapshot.

## Considered alternatives

- **Submitted-only live read** (viewer sees only submitted sections by default,
  with an explicit Show all control). This is the accepted current behavior.
- **Keep published-only, just surface submission status** (a counter without
  content). Rejected: it does not fix the core gap — the viewer still cannot see
  the actual current content a lead has produced this week.
- **Make search live too.** Rejected for the MVP: Search is an immutable
  published-content surface, while Status is the live current-period surface.
