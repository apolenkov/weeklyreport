# Design — viewer-live-status

Durable rationale lives in **ADR 0007**; this file holds the change-scoped
technical decisions. Canonical terms per `CONTEXT.md` ("Current period", "Status
target", "Status observation", "Lead submission").

## Terminology — Current period vs Status target

`CONTEXT.md` reserves **Current period** for the editable state (`open` /
`reopened`, non-archived). The viewer's entry can also fall back to a past
published report, which is NOT a current period. This change uses **Status target**
for the resolved destination: the Current period when one exists, else the latest
viewer-visible published report. "Current period (any state)" is avoided — published
is a fallback, not a current period.

## Decision 0 — One source of truth: `currentEditableId` (editable-only, non-archived)

Both the gate and the entry resolver hinge on the SAME "current period" id, so it
must be resolved by ONE helper, used by both — otherwise the entry can resolve to a
report the gate rejects, and an `open → published` race can pass the gate against a
stale live model.

`currentEditableId` = the global newest **editable** period only — `findFirst({
periodStatus in [open, reopened], periodStart <= now, archived: false }, orderBy
periodStart desc }).id ?? null`. It deliberately has **no published fallback** (the
gate already allows any `published` report via its first clause) and adds
`archived: false` (a `Current period` is non-archived per `CONTEXT.md`; the admin
archive path does not force `periodStatus`, so an archived row can still read
`open`). This is NOT `getActiveReportId()` — that method carries a published
fallback and no `archived` filter, which would re-introduce both bugs.

**The seam (single source enforced):** the query lives in ONE place — a
`getCurrentEditableId()` method on the `WeeklyReportRepository`, surfaced through
`WeeklyReportService.getCurrentEditableId()`. The gate (inside the service) calls
`this.repository.getCurrentEditableId()`; the `latestForViewer` router resolver calls
`deps.weeklyReportService.getCurrentEditableId()`. The router has `prisma` and
`weeklyReportService` but NOT the repository, so going through the service is what
prevents a duplicated inline query that would silently diverge.

## Decision 1 — Replace the read gate, don't remove it (fail-closed against `currentEditableId`)

The viewer read gate at `weekly-report.service.ts` becomes published-or-current:

```
role === "viewer"
  && readModel.periodStatus !== "published"
  && resolvedId !== currentEditableId       // editable-only (Decision 0)
  → throw not-found
```

A viewer may read a report iff it is `published` (any past published report, for
History) OR it is the current editable period. The naive "remove the gate" would let
an explicit `weeklyReport.get({ reportId })` expose any guessed `open` / `reopened`
/ scheduled-future / archived-open period.

**Fail-closed ordering (TOCTOU + open→published race):** the service computes
`currentEditableId` no earlier than the report fetch and rejects when the fetched id
is neither `published` nor the current editable id. Because `currentEditableId` is
**editable-only** (no published fallback): if the fetched-open report A is published
mid-request, `currentEditableId` no longer equals A, the equality fails, and the
read is **rejected** — never the stale live model, never a leak. If a newer editable
period appears, the older fetched one likewise fails the equality. Every race
resolves toward not-found. No transaction required.

**Recovery after a race-`NOT_FOUND`.** The query client does NOT auto-retry
`NOT_FOUND` (`lib/query-client.ts`), so a race reject would otherwise leave a
terminal "not found" notice until a manual reload. Because `/reports/latest`
re-resolves on every visit, the cheap, bounded fix is a **one-shot** redirect — but
it needs a marker, because the report route alone cannot tell a Status navigation
from a History/direct one, nor whether it already retried:

- `/reports/latest` reads an incoming `recovery` (default `0`), resolves, and
  `router.replace`s to `/reports/[id]?source=status&recovery=<that value>` — it
  **propagates** the flag onto the resolved URL rather than always emitting `0`.
- On the report route, a `NOT_FOUND` is recovered ONLY when `source=status` AND
  `recovery=0`: it redirects once to **`/reports/latest?recovery=1`** (carrying the
  flag UP). That resolves and lands on `/reports/[id]?source=status&recovery=1`.
- A `NOT_FOUND` with `recovery=1` shows the terminal notice — the flag is now set, so
  the second failure does not redirect. This is what bars the loop.
- A `NOT_FOUND` without `source=status` (History or a directly-typed id) shows the
  terminal notice immediately, unchanged.

This is the only recovery affordance in scope — a generic retry policy is not.

## Decision 2 — `latestForViewer` targets `currentEditableId` if visible, else newest visible published

The entry must route only to a report the gate will open AND that has viewer-visible
content. It uses `currentEditableId` (Decision 0), NOT a separate "newest visible
editable" search — searching older editable periods would route to a report the gate
rejects (the gate authorizes only `currentEditableId`). Resolution:

1. if `currentEditableId` is non-null AND that exact report has a viewer-visible
   section (`findFirst({ id: currentEditableId, sections: { some: sectionScope } }`)
   → target `currentEditableId`;
2. else the newest **viewer-visible published** report (`findFirst({ periodStatus =
published, sections: { some: sectionScope } }, orderBy periodStart desc`);
3. else `{ reportId: null }` (empty state).

The published fallback is group-scoped (newest _visible_ published, not the globally
newest). `sections.some(sectionScope)` proves a viewer-visible SECTION exists (not
non-empty content) — the intended, implementable bar; the requirement says "no
viewer-visible section", not "no content".

## Decision 3 — Determinism without the period-creation lock

The period-creation lock is a separate change, so two concurrent `open` periods can
exist. "Current" = newest editable (`periodStart desc`), so resolution is
deterministic and the older period is non-current → fail-closed by the Decision-1
id check. This change does NOT depend on the lock landing first.

## Decision 4 — Reopened shows live content; no snapshot-sticky

`reopenPeriod` flips `periodStatus → reopened` and resets sections to `draft`
(`submittedAt = null`) but does NOT delete section text or clear
`publishedSnapshot`. Because the viewer now sees draft content, a reopened period
shows its live rows (text intact, marked draft) — it does not blank out. No special
"serve the frozen snapshot during reopen" branch is needed. The repository rule
stands: `periodStatus === "published"` serves the snapshot; anything else serves
live rows.

## Decision 5 — Viewer History lists only openable (published) periods — VIEWER-ONLY

`compiledHistory` filters legacy `status = "published"`, and `reopen` deliberately
leaves legacy `status = "published"` while moving `periodStatus → "reopened"`. So a
reopened period can appear in the viewer's History list, but the published-or-current
gate rejects it unless it is the current period — a broken link. The viewer History
MUST therefore list only reports the gate can open: filter to `periodStatus =
"published"` **for the viewer role only**. `compiledHistory` is a shared
`anyRoleProcedure`, so this filter MUST be role-conditional (`role === "viewer"`) —
an unconditional filter would silently change head/lead History (a non-goal). Tests
MUST cover both the viewer filter AND head/lead non-regression. A reopened period is
then shown to the viewer only as the current Status (when current), never as a dead
History row; this also removes the viewer Status/History overlap for reopened
periods.

## Decision 6 — Drafts are visible everywhere the viewer reads (accepted asymmetry)

No submitted-only filter is added. On `open` / `reopened` the viewer sees live
drafts; on `published` it sees the frozen snapshot, which already contains whatever
drafts existed at publish time. This published-vs-live asymmetry is pre-existing and
accepted for v1 (ADR 0007). The status counter keeps its current source
(`status === "submitted"`), unchanged.

## Decision 7 — Search stays published-scoped (accepted read/search divergence)

`viewer-published-search` is behaviorally unchanged: search still returns only
`published` content. The READ now goes live, so a viewer can read a live record
before search can find it. The `viewer-published-search` requirement is MODIFIED
only to drop its now-false read/search **parity** claim and to reword the
cross-group audit scenario to the truth: under the author-group filter (and product
hits excluded), a viewer search can never produce a cross-group product access, so
`scopeAccessed` never fires for viewer search — it is not an audit gap, it is a
no-op by construction.

## Decision 8 — Toolbar: remove Back-to-Archive; KEEP Agent-review

Back-to-Archive is removed from the viewer report shell — History is in the nav and
no durable spec governs it. Agent-review (`AgentReviewComingSoon`) is **kept**:
`deferred-feature-pattern` mandates exactly one `AgentReviewComingSoon` on every
report-reading surface including the viewer `/reports/[reportId]`, for deferred-
feature consistency. Removing it would violate that durable contract, so it stays
unless the contract is explicitly amended (open question for sign-off).
`report-toolbar-parity` is MODIFIED to drop its stale "published-only guarantees
stay intact" phrase; the read-only and control-set guarantees are unchanged.

## Decision 9 — Pill state is OUT OF SCOPE (pre-existing, shared component)

The lifecycle "Live" pill lives in the shared `WeeklyReportPage`, not the viewer
shell, so changing it would alter head and lead-preview rendering. The always-green
"Live" pill is a pre-existing issue, not introduced by this change, and is not
user-requested here. It is left as a noted follow-up; this change does not touch the
shared pill.

## Decision 10 — Nav highlight: rename only; precise active-state deferred

"Latest" → "Status" is the in-scope change. Precise active highlighting is deferred:
Status and History both resolve to `/reports/[id]`, and the durable
`lead-history-summary` contract marks History active on published-report paths, so a
pathname-only rule cannot uniquely light Status without amending that contract and
threading a route/id marker. v1 keeps the rename; the active-state nicety is a noted
follow-up rather than a contract change.

## `latestForViewer` and non-viewer roles

`latestPublished`'s only production consumer is the viewer `/reports/latest` route;
its lead/admin behavior was defensive-only (no caller). `latestForViewer` keeps
`anyRoleProcedure` (the route needs it) with viewer-oriented semantics; non-viewer
READ paths (`weeklyReport.get` for head/lead/admin) are genuinely unchanged. The
proposal's "unchanged" claim is scoped to those read paths, not to this replaced
resolver.

## User-visible states (for the route + tests)

| Situation                                            | Viewer sees                                         |
| ---------------------------------------------------- | --------------------------------------------------- |
| Current `open` period, viewer-visible                | live report, drafts included, "X/N submitted" badge |
| Current `reopened` period                            | live report (text intact, draft)                    |
| No current period, a viewer-visible published exists | latest visible published snapshot                   |
| No viewer-visible report at all                      | empty state ("no report to show yet")               |
| Viewer with no group access                          | empty state (zero-row scope), no leak               |
| Explicit non-current `open` / future id              | rejected (not-found)                                |

## Out of scope (explicit)

Draft-hiding / submitted-only viewer read; live search; period-creation lock; the
shared lifecycle pill; precise nav active-state; head / lead / admin read paths.
