# Head and viewer default to submitted-only on the live current period

**Status:** proposed (locked via `grill-with-docs-codex` on 2026-06-30; not yet
implemented — tracked by `openspec/changes/review-acknowledgement`)

## Context

ADR 0007 made the viewer (and the head) see live draft content by default, and
explicitly **rejected a submitted-only live read for v1**, citing the user's own
call — "don't overcomplicate; show it like the head, drafts included" — and the
complexity it would pull in: a `submittedAt` filter on the live read AND a matching
filter on the frozen `publishedSnapshot` (which froze unsubmitted content at publish
time), plus snapshot-sticky handling on `reopened` to avoid the report blanking. It
was kept as a recognized privacy/UX follow-up.

Demo feedback now asks for exactly that follow-up: by default the head and viewer
want to see only what is **submitted** ("what's ready"), with a toggle to see
everything including drafts — like the lead's Mine/Everyone card toggle, on the
submitted/all axis.

## Decision

The head and viewer **default to a submitted-only view of the live current period**,
with a per-user toggle to all sections (drafts included). To avoid reopening the
complexity ADR 0007 declined, the toggle is **scoped to the live current period
only**:

- It filters which sections render within an already-authorized period; it does NOT
  change the read gate (which periods/groups are authorized) — that stays exactly as
  `viewer-report-navigation` defines it.
- The **published snapshot renders as-is**, unfiltered by submission state. There is
  no snapshot reconciliation and no `reopened` snapshot-stickiness — the precise
  complexity ADR 0007 rejected stays closed.
- An **anti-empty-state guard** preserves the head's existing guarantee
  (`head-report-visibility`): when draft content exists but is filtered out by the
  default, the UI signals "N in draft — show all" rather than the misleading
  "No submissions yet" empty state, which renders only for a content-less period.
  The same guard covers a reopened period, whose sections are all draft.

This **amends ADR 0007.** ADR 0007's read-gate and "drafts are reachable" decisions
stand; this narrows the _default_ from "drafts shown" to "drafts one toggle away",
adopting the follow-up ADR 0007 named — but only on the live read, so 0007's rejected
publishedSnapshot/`reopened` complexity is never incurred.

## Consequences

- The head, opening an all-draft live period, sees a "drafts hidden — show all"
  signal, not content and not a blank. Submission counts (`Live · X/Y Submitted`)
  and the dashboard still convey who has not submitted.
- A reopened period (sections reset to draft) is hidden by the default and reachable
  via the toggle, signalled, never a blank.
- The toggle is a per-user view filter; it grants no new data access (group scope
  unchanged), so it carries no authorization risk.
- Search is unaffected (it remains published-scoped per `viewer-published-search`).
