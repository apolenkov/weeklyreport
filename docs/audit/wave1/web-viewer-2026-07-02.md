# Per-file audit — apps/web/src/components/viewer (2026-07-02)

Read-only audit, wave 2 web.
1 file, 6 findings kept, 0 killed.

## viewer-report-shell.tsx (6 findings)

| Lines          | Dimension       | Severity | Finding                                                                                                                                                                                                                                                                                                                                                             | Suggestion                                                                                                                                                                                                                                                                                                                            | Your verdict |
| -------------- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 53-261         | size-complexity | high     | `ViewerReportShell` is a single ~209-line function mixing URL/query-param plumbing (buildQuery, includeArchive, scope), two react-query fetches, one-shot redirect-recovery logic, ReportPeriod list construction, and two divergent render branches (slides vs form). Hard limit is 50 lines/function; this is 4x over and covers at least five distinct concerns. | Extract a shared `useReportShellToolbarState(reportId, basePath)` hook (buildQuery/includeArchive/scope/urlBuilder/periods) usable by both ViewerReportShell and HeadReportShell, and pull the recovery-redirect logic into its own `useViewerRecoveryRedirect` hook. Leaves the component with just query wiring + JSX.              |              |
| 29-52          | comments        | high     | 24-line JSDoc header narrating three separate change-log episodes (viewer-report-surface-parity task 5, viewer-live-status task 5.1, task 4.3) with phase/task references — far over the 3-line non-obvious-WHY budget, and reads as ticket archaeology the tighten-comment-policy explicitly targets.                                                              | Per policy this is load-bearing rationale over budget, not a plain delete: relocate the durable WHY (published-or-current race, one-shot recovery contract) into the openspec spec for viewer-live-status, and leave at most a 2-3 line pointer comment here.                                                                         |              |
| 66-72, 101-108 | comments        | medium   | Two more inline comment blocks (7 and 8 lines) re-narrate the same one-shot recovery / source-param-stripping rationale already covered by the file-header JSDoc — duplicated explanation, still well over the 3-line budget each.                                                                                                                                  | Collapse to one place: keep a single short WHY comment near the `shouldRecover` computation, drop the repeated version near buildQuery, and move the full narrative to the spec as above.                                                                                                                                             |              |
| 63-94, 121-179 | duplication     | high     | buildQuery, includeArchive/setIncludeArchive, the ReportPeriod-mapping closure, urlBuilder, and scope/setScope are near byte-for-byte duplicates of the same blocks in `apps/web/src/components/head/head-report-shell.tsx` (lines 63-188) — same URL-param plumbing pattern reimplemented per shell instead of shared.                                             | Factor the common toolbar/URL-state logic into a shared hook (e.g. `apps/web/src/components/report-shell/use-report-toolbar-state.ts`) parameterized by base path and consumed by both HeadReportShell and ViewerReportShell; each shell keeps only what actually differs (head's active-period prepend, viewer's recovery redirect). |              |
| 73-74, 109-113 | constants       | medium   | The URL-param contract `source=status` / `recovery=1` is a magic-string cross-file protocol shared with `apps/web/src/app/(app)/reports/latest/page.tsx` (which writes `?source=status&recovery=${recovery}`) — both sides hardcode the literal strings "source", "status", "recovery", "1" independently with no shared symbol.                                    | Define named constants (e.g. `STATUS_REDIRECT_SOURCE = "status"`, `RECOVERY_PARAM = "recovery"`) in packages/shared or a small co-located module imported by both page.tsx and viewer-report-shell.tsx, per the CLAUDE.md rule that cross-file contracts belong in packages/shared.                                                   |              |
| 213, 227-260   | duplication     | low      | The literal string "Opening the status report…" is duplicated verbatim in `apps/web/src/app/(app)/reports/latest/page.tsx`; the slides-mode `<header>`/title JSX (lines 231-236) is also a near-duplicate of the equivalent block in HeadReportShell (minus headerContextLabel/Publish-lock).                                                                       | Low priority given the two-shell scope, but if a third viewer-like shell appears, extract a shared `ReportStatusResolvingNotice` and a `ReportShellSlidesHeader` slot component.                                                                                                                                                      |              |

Already good: composes exactly the shared toolbar primitives (PeriodNavigator, ArchiveToggle, ScopeToggle, ViewModeToggle, ReportToolbar, AgentReviewComingSoon) rather than re-styling its own chevrons/toggles, matching HeadReportShell; fully immutable (no let/reassignment, period lists and query overrides built with map/spread/Set, recovery guard is a single derived boolean); ComingSoon usage goes through the shared primitive, consistent with the rest of the report shells.

## Rollup

**By dimension:**

- size-complexity: 1 (high)
- comments: 2 (1 high, 1 medium)
- duplication: 2 (1 high, 1 low)
- constants: 1 (medium)

**By severity:**

- high: 3
- medium: 2
- low: 1

**Top 3:**

1. `ViewerReportShell` 209-line mega-function, 5+ concerns tangled (size-complexity, high).
2. 24-line ticket-archaeology JSDoc header + two duplicate inline comment blocks re-narrating the same rationale (comments, high/medium).
3. Near byte-for-byte duplication of URL/toolbar-state plumbing with `head-report-shell.tsx` (duplication, high).

**Overlaps with pending OpenSpec changes (handle there, not in a style sweep):** none. None of the 6 findings intersect the pending list (unified-activity-entry, fix-manual-publish-archive-race, head-surface-parity-declutter, responsive-compact-layout, project-activity-reporting, review-acknowledgement, input-and-error-hardening, code-health-and-test-cleanup, fix-dashboard-nan-pending, key-charts-by-id, fix-analytics-date-matching, harden-web-vitals-endpoint, fix-prod-web-build-args, fix-open-redirect-next-param, tighten-code-quality-ratchet, tighten-comment-policy, map-domain-errors, escape-org-data-script) — the comments findings are candidates for `tighten-comment-policy` execution but were not pre-declared against this file, so they remain listed here as general findings pending triage.

## Killed by verification

None — 0 findings killed.
