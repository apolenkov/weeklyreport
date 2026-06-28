## Context

Two client-only components on the head dashboard (`/head/dashboard`) produce
incorrect output for edge states that are reachable in the normal product
lifecycle.

**`KpiCards`** (`apps/web/src/components/dashboard/kpi-cards.tsx`) computes
`submissionPercent` by dividing `data.submitted` by `data.total` with no guard.
When a reporting period opens before any leads are enrolled, `data.total === 0`
and the division yields `NaN`. That `NaN` value flows into the conic-gradient
`background` style (a broken CSS value the browser silently discards, leaving the
ring unstyled) and into the `title` attribute string (rendered as the literal
text `"NaN%"`).

**`AlertBar`** (`apps/web/src/components/dashboard/alert-bar.tsx`) receives a
`pendingLeads: string[]` prop whose values are already filtered to leads who
have not yet started a submission. A positional heuristic (`isDraft = i === 0`)
labels the first entry "Draft" — a semantically incorrect label, because the
prop contract guarantees every entry is not-started, never in-progress.

Both components are pure client components with no tRPC calls, no shared
schemas, and no server-side impact. No other file reads `submissionPercent` or
the `isDraft` branch.

## Goals / Non-Goals

**Goals:**

- `KpiCards` always produces a finite `submissionPercent` (falls back to `0`
  when `total === 0`).
- `AlertBar` labels every entry in `pendingLeads` as "Not started", removing the
  incorrect positional heuristic.
- Regression tests cover the zero-total ring and the label-accuracy invariant.

**Non-Goals:**

- Passing richer per-lead status data into `AlertBar` — the prop remains
  `string[]`; a typed status prop is a separate concern.
- Any API, tRPC, or shared schema changes.
- Any styling or layout changes beyond the correctness fix.
- Changing when `AlertBar` is visible (the `reopenCount` + `pendingLeads`
  dual-signal visibility logic is untouched).

## Decisions

### D1 — Fall back to 0, not to a hidden/empty state

When `total === 0` the ring renders with `submissionPercent = 0`, producing a
solid border-colored arc and the title `"0 of 0 leads submitted this week
(0%)"`. Alternative: hide the ring entirely. Rejected — hiding adds conditional
layout that can shift surrounding elements; a `0%` ring is the correct semantic
reading of "no submissions yet" and is already the visual default before any
leads enroll.

### D2 — Remove isDraft rather than derive it from props

The `isDraft` branch is deleted rather than replaced with a prop-driven flag.
The `AlertBar` caller (`DashboardPage`) does not hold per-lead draft/pending
distinction at call time — `pendingLeads` is a `string[]` of names already
filtered server-side. Introducing a parallel typed structure would widen the
prop surface for a label that the filter contract already implies. Every entry in
`pendingLeads` is not-started by definition, so "Not started" is the only
correct label without any additional data.

## Risks / Trade-offs

- **No risk of regressions in the non-zero-total path**: the guard is
  `data.total > 0 ? Math.round(...) : 0`. When `total > 0` the existing
  division runs identically to today.
- **`AlertBar` label change is user-visible**: any period that currently shows
  the first pending lead as "(Draft)" will show "Not started" after the fix.
  This is a correctness correction — the prior label was wrong — so no
  intentional behavior is removed.
- **No migration, no feature flag, no rollout sequencing**: both changes are
  in isolated client components with no server-side coupling. They take effect
  on the next build with no coordination required.

## Open Questions

None. Both fixes are unambiguous correctness patches with no design forks.
