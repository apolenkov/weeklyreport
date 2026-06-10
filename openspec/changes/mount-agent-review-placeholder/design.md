## Context

`AgentReviewComingSoon` is an inert deferred-feature placeholder defined at
`apps/web/src/components/report-shell/agent-review-coming-soon.tsx:10`. It
renders a disabled "Agent review" button with a `ComingSoonBadge` hover
tooltip and supports a `compact` prop that drops the touch-target min-height
for tight rows (`apps/web/src/components/report-shell/agent-review-coming-soon.tsx:23`).

Current mount points, verified by grep:

- `apps/web/src/components/slides/status-slide-deck.tsx:221` — head slide hero.
- `apps/web/src/components/slides/lead-slides-client.tsx:188` — lead single-slide hero.
- `apps/web/src/components/slides/lead-slides-client.tsx:224` — lead deck toolbar.
- `apps/web/src/components/head/head-report-shell.tsx:141` — head report shell toolbar (compact).
- `apps/web/src/components/lead/lead-form.tsx:1489` — lead form, edit mode.
- `apps/web/src/components/lead/lead-form.tsx:1505` — lead form, slides mode.

The component's own note marks the work as unfinished:
`apps/web/src/components/report-shell/agent-review-coming-soon.tsx:6` —
`TODO(AGENT-REVIEW-01): mount in lead+head slide and report surfaces`.

## Goals / Non-Goals

**Goals:**

- Make the placeholder appear on every on-screen surface that renders report
  content for a reader, so coverage is consistent.
- Keep the change purely additive and inert — reuse the existing component,
  add no behavior.

**Non-Goals:**

- No activation of any agent-review behavior; the control stays disabled.
- No new color tokens, no palette change, no new UI strings.
- No mount on print/PDF or list-only (history/archive) surfaces.
- No mount inside the shared `WeeklyReportPage` body (would duplicate the
  header-level placeholder in head edit mode).

## Decisions

### Decision 1: Mount at page-level headers, not inside `WeeklyReportPage`

`WeeklyReportPage` is the shared body rendered by the published viewer, both
present surfaces, the lead preview, and head edit mode. Head edit mode already
carries the placeholder in its shell toolbar
(`apps/web/src/components/head/head-report-shell.tsx:141`). Mounting inside the
shared body would put two placeholders on that surface. Mounting at each
consuming page header keeps exactly one per surface.

Alternative considered: mount once inside `WeeklyReportPage`. Rejected — it
double-renders in head edit mode and gives no control over the print path,
which also renders report content but must stay clean.

### Decision 2: Four surfaces gain the control; two surface classes stay out

Gains (each has a header control cluster where the existing pages already group
links/buttons):

- Published viewer header — `apps/web/src/app/(app)/reports/[reportId]/page.tsx:38`.
- Head present header — `apps/web/src/app/(app)/head/report/[reportId]/present/page.tsx:28`.
- Published present header — `apps/web/src/app/(app)/reports/[reportId]/present/page.tsx:21`.
- Lead self-preview header — `apps/web/src/app/(app)/lead/report/[reportId]/preview/page.tsx:46`.

Stays out:

- Print/PDF — `apps/web/src/app/print/[reportId]/page.tsx`. It is a paper
  artifact rendered as inline-styled A4 markup; a hover-only "coming soon"
  tooltip cannot function on paper, and the page already hides its `.no-print`
  chrome at print time (`apps/web/src/app/print/[reportId]/page.tsx:519`).
- History/archive lists — they enumerate reports, they do not render a single
  report's content, so a per-report agent-review affordance has no anchor there.

### Decision 3: Variant per row

Use the `compact` variant where the header row groups several pill controls at a
reduced height (matching the head shell precedent at
`apps/web/src/components/head/head-report-shell.tsx:141`). Use the default
variant where the row is sparse. Final per-row choice is an implementation
detail bounded by `ui-control-density`: the deferred placeholder MAY render
compact below the cluster's interactive height
(`openspec/specs/ui-control-density/spec.md:43`).

## Risks / Trade-offs

- [Duplicate placeholder if also added to the shared body later] → Spec records
  the one-per-surface rule and the explicit page-header mounting decision.
- [Reader confusion: an inert control hints at a working feature] → This is the
  intended deferred-feature signal per `deferred-feature-pattern`; the
  `ComingSoonBadge` tooltip states it is not yet available.
- [Header row crowding on narrow viewports] → The clusters already use
  `flex-wrap`; the compact variant keeps height in line with neighbors.

## Invariants

- `deferred-feature-pattern` — preserved and extended: the placeholder stays a
  visible inert `ComingSoonBadge` control, never a hidden flag.
- `ui-control-density` — preserved: compact placeholder allowed below cluster
  height.
- `period-dual-state`, `role-coverage-gate`, `destructive-db-guard` — untouched;
  this change is frontend-only and reads no period state or tRPC procedure.

## Migration Plan

Pure frontend additive change. No migration, no flag, no rollout order. Rollback
is reverting the four edits. The `TODO(AGENT-REVIEW-01)` marker stays until the
real agent-review feature is built, per `deferred-feature-pattern`.

## Open Questions

- Should the lead self-preview show the placeholder, given the lead already sees
  it in the form and slides? Captured assumption: yes — the preview is a
  distinct read surface and consistency is the goal; revisit if it reads as
  redundant in UAT.
