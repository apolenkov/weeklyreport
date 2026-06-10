## Why

The `AgentReviewComingSoon` deferred-feature placeholder is meant to tell
every reader of a report that an agent-review capability is roadmapped. Today
it appears on only a subset of report surfaces, so the same report shows the
"Agent review" affordance in slides and the head shell but drops it on the
published viewer, the presentation surfaces, and the lead self-preview. The
placeholder's own activation note already flags this gap:
`apps/web/src/components/report-shell/agent-review-coming-soon.tsx:6` —
`TODO(AGENT-REVIEW-01): mount in lead+head slide and report surfaces`.

## What Changes

- Mount `AgentReviewComingSoon` on the report surfaces that currently lack it
  so coverage is consistent across all on-screen report views.
- Surfaces that GAIN the control (on-screen, interactive):
  - Published report viewer header — `apps/web/src/app/(app)/reports/[reportId]/page.tsx:38`.
  - Head presentation page header — `apps/web/src/app/(app)/head/report/[reportId]/present/page.tsx:28`.
  - Published presentation page header — `apps/web/src/app/(app)/reports/[reportId]/present/page.tsx:21`.
  - Lead self-preview page header — `apps/web/src/app/(app)/lead/report/[reportId]/preview/page.tsx:46`.
- Surfaces that DELIBERATELY do NOT gain it (justified in design.md):
  - Print/PDF template — `apps/web/src/app/print/[reportId]/page.tsx`. It is a
    paper artifact; an inert hover-tooltip control is meaningless on print and
    its `.no-print` peers are hidden at print time anyway
    (`apps/web/src/app/print/[reportId]/page.tsx:519`).
  - History/archive list pages — they list reports, they do not render report
    content.
- No new mount inside the shared `WeeklyReportPage` body, to avoid duplicate
  placeholders where a page header already carries one (head edit mode already
  mounts it at `apps/web/src/components/head/head-report-shell.tsx:141`).
- Inert UI only: no behavior, no new state, no color tokens, no string change
  beyond reusing the existing component.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `deferred-feature-pattern`: add a requirement that the agent-review deferred
  placeholder MUST appear on every on-screen report surface and MUST be absent
  from print/PDF and list-only surfaces.

## Impact

- Affected code: four page-level header clusters listed above; one shared
  present wrapper (`apps/web/src/components/head/head-present-client.tsx`) if
  the present pages mount through it rather than at the page header.
- No API, schema, dependency, or migration impact — frontend-only, inert.
- Respects `deferred-feature-pattern` (ComingSoonBadge) and
  `ui-control-density` (compact variant for tight header rows).
