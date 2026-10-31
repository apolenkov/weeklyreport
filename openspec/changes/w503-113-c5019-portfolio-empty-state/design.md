# Design

## Decision

The gate in `ReportContent` changes from
`!hasAnyContent && periodStatus !== "published"` to `!hasAnyContent`.

- Owner component: the existing `ReportEmptyState` (report-pages). No new
  component. `PortfolioOverviewTable` (report-sections) is not changed, which
  avoids a report-pages to report-sections import cycle.
- `hasAnyContent` already counts full content (`weekly-report-page-helpers.ts`),
  so the gate key is unchanged; only the published exemption is removed.
- The gate no longer reads `periodStatus`; that `ReportContent` prop had no
  other use and is removed with its caller (`weekly-report-page.tsx`).

## Rationale for removing the exemption

No spec or ADR documents a published exemption. The clause appeared in refactor
`02fdc292e` (2026-08-06), with no rationale in its message. The spec
`head-report-visibility` already states the empty state keys off full content.

## Risk

A published report with products but `hasAnyContent === false` would hide its
overview. `hasAnyContent` is derived from the same read model as the overview
products, so this combination should not occur. Unit coverage is the RED/GREEN
test; browser publish-to-read is NOT-PROVEN.
