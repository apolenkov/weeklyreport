## Context

See `proposal.md` and `research.md`. The lead form currently loads one selected
section and renders either Edit or Slides. `reports.myHistory` exposes counts,
not the prior plan content. Published history is frozen in
`Report.publishedSnapshot`; live submitted sections remain the bounded fallback.
The accepted `unifiedActivityView` groups current data by workflow state and is
not the temporal comparison requested here.

## Goals / Non-Goals

**Goals:**

- add an editable Overview route mode without duplicating write state;
- expose one validated current-plus-predecessor projection;
- reuse existing Product, Activity, item, status, and visual primitives;
- keep source counts, authorization, and lifecycle semantics mechanically testable.

**Non-Goals:**

- no new persistence, carry-over rule, or configurable organization flag;
- no new Product/Project/Activity hierarchy;
- no head/viewer/PDF surface redesign.

## Decisions

### Use one server-owned overview projection

Before:

```text
Lead route -> leadForm.byPeriod -> current section -> Edit | Slides
```

After:

```text
Lead route(mode=overview)
  -> leadForm.statusOverview(reportId)
  -> authorize selected section
  -> locate immediate predecessor by periodStart
       -> published snapshot section
       -> else submitted live section
       -> else unavailable
  -> validated current + previous-plan response
  -> pure reporting-unit projection -> Overview UI
```

The API returns report/period identities and the two authorized section shapes;
the Web layer derives peer reporting units and continuity labels. This avoids a
second client-side history join and keeps snapshot parsing and ACL enforcement
server-owned. A new shared output schema protects the tRPC boundary.

Alternative rejected: deriving Previously planned from `carriedOver`. It omits
completed, abandoned, and otherwise unmatched prior plans.

### Make Overview the route default and reuse the canonical editor seam

No `mode` selects Overview; `mode=edit` and `mode=slides` are explicit. The
three-segment toggle uses links so each mode remains bookmarkable and can open
in a new tab. Canonical redirects preserve mode and SitePing parameters.
Overview mounts the existing lead editor module once and projects its live draft
into the compact matrix. Current and Next items open the existing item dialog on
the same page; dialog saves emit the existing `DraftPatch` variants and use the
same generation guard, autosave, optimistic version, cache invalidation, ACL,
and lifecycle enforcement as Edit. Previously planned never exposes a write
target. An `Edit details` link enters Edit for product stages, activity status,
risks, decisions, submission, and other full-authoring workflows.

Alternative rejected: a separate Overview mutation or local form store. It
would duplicate write semantics and create divergent autosave and conflict
behavior.

### Keep temporal projection separate from unifiedActivityView

The Overview consumes the same current section but does not alter the accepted
by-state edit projection or its organization setting. Product and Activity
status functions remain their existing sources of truth. Items are grouped by
parent identity, and orphaned historical parents are appended deterministically.

### Use disclosure, not a modal

Each unit is a flat matrix row with thin separators rather than nested cards.
Collapsed columns clamp to two items and expose an operable remainder control;
expanded rows mount the complete content on the same shared three-column grid.
Responsive CSS turns the columns into a contained sequential layout below the
desktop breakpoint.

## Invariants

- Period dual-state: preserved; all writes use the existing atomic editor path.
- Role-coverage gate: the new tRPC query uses a canonical procedure builder.
- Destructive DB guard: unaffected; no schema or destructive operation exists.

## Risks / Trade-offs

- [Malformed or absent historical snapshot] -> use existing strict snapshot
  parser and return an explicit unavailable reason rather than live-data drift.
- [Extra query cost] -> one indexed predecessor lookup and one scoped section;
  query only in Overview mode and test the bounded query shape.
- [Default-mode workflow surprise] -> keep Edit one visible segment away and
  preserve explicit `mode=edit` links from authoring actions.
- [Two competing draft stores] -> Overview consumes the canonical editor handle
  and never owns an independent persisted form state.
- [Long text or many units] -> preview clamping, inline disclosure, and
  overflow assertions at both accepted desktop viewports.

## Migration Plan

No data migration is required. Ship shared/API contracts first, then the Web
mode and its canonical-editor adapter. Rollback removes the Overview segment
and returns the no-mode route to Edit; persisted data and published snapshots
remain unchanged.
