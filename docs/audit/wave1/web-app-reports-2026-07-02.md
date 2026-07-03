# Per-file audit — apps/web/src/app/(app)/reports (2026-07-02)

Read-only audit, wave 2 web.

7 files: `[reportId]/page.tsx`, `[reportId]/present/page.tsx`, `history/page.tsx`,
`latest/page.tsx`, `page.tsx`, `trends/page.tsx`, `layout.tsx`.

16 findings kept, 2 killed by verification.

## [reportId]/page.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                                         | Suggestion                                                                                                                                                                                                                                                   | Your verdict |
| ----- | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 11-21 | comments  | medium   | 11-line JSDoc header on the page component, ~4x the 3-line comment budget, and opens with a phase/task reference ('viewer-report-surface-parity (task 5)') — exactly the ticket/phase archaeology the comment-hygiene rule bans (git history already holds it). | Strip the task-ref sentence entirely; keep only the non-obvious WHY (viewer surface has no mutation affordances, Publish/Reopen gated to head/admin) in <=3 lines, or relocate the fuller rationale into the openspec spec for viewer-report-surface-parity. |              |

Already good: Clean delegation to ViewerReportShell behind a single Suspense boundary; the page itself stays a thin composition root instead of absorbing shell logic.

## [reportId]/present/page.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                          | Suggestion                                                                                                                            | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 7-14  | comments  | low      | 8-line comment over the 3-line budget, prefixed with a ticket ref ('fix-report-surface-integrity W2 (task 3.3)') that is change-log archaeology. | Drop the task prefix; keep the load-bearing WHY (route kept alive for deep links, must be a 308 not Next's default 307) in 2-3 lines. |              |

Already good: Minimal, single-purpose redirect shim kept alive intentionally for deep-link compatibility with correct 308 semantics via permanentRedirect — good example of not deleting a route just because it's now 'just a redirect'.

## history/page.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                       | Suggestion                                                                           | Your verdict |
| ----- | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------ |
| 3-10  | comments  | low      | 8-line comment on a 3-line redirect component, well over the 3-line budget (no ticket refs here, but still narrates more than the WHY needs). | Trim to 2-3 lines: why /reports/history collapses into /reports with no query param. |              |

Already good: Trivial, obviously-correct server redirect component; no unnecessary client-side machinery for a pure route collapse.

## latest/page.tsx (2 findings)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Suggestion                                                                                                                                                                                                                                                                                                                                                          | Your verdict |
| ----- | --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 9-28  | comments  | high     | 20-line JSDoc header (~7x the 3-line budget) full of ticket/phase references ('viewer-live-status (task 4.2/4.3)', 'Decision 1') on a 44-line file — this is the comment-hygiene violation the policy explicitly calls out for relocation, not deletion, since the recovery/race rationale is genuinely load-bearing.                                                                                                                                       | Move the full race-recovery rationale (why client-side router.replace, why the recovery flag propagates rather than hard-coding 0) into the relevant openspec spec; leave a <=3-line WHY comment here pointing at the mechanism, stripped of task/decision numbering.                                                                                               |              |
| 33,41 | constants | medium   | The query-param contract between this page and viewer-report-shell.tsx ('source'/'status'/'recovery' keys, '1'/'0' string values) is hardcoded independently in both files (see apps/web/src/components/viewer/viewer-report-shell.tsx lines 73-74, 109-117 building/reading the same literals). Per the STRICT constants policy, a cross-file contract like this belongs in a shared module, not duplicated inline string literals in two unrelated files. | Extract named constants (e.g. STATUS_REDIRECT_SOURCE = 'status', RECOVERY_PARAM = 'recovery') or a small shared helper (buildStatusRedirectUrl(reportId, recovery)) into a colocated apps/web lib module (packages/shared not required — both consumers are web), and have both this page and viewer-report-shell.tsx consume it instead of re-typing the literals. |              |

Already good: Loading/error/resolving states are derived cleanly from query state (isResolving, isError) rather than duplicated into extra useState; the useEffect is a legitimate navigation side-effect, not a derivable-during-render case.

## page.tsx (6 findings)

| Lines         | Dimension       | Severity | Finding                                                                                                                                                                                                                                                                                                                             | Suggestion                                                                                                                                                                                                                              | Your verdict |
| ------------- | --------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 35-171        | size-complexity | high     | ReportsPage function body is 137 lines (35–171), nearly 3x the 50-line hard cap, and packs five concerns: role derivation, two competing react-query fetches, error-toast side effect, entry/archive/subtitle derivation via four independent role ternary chains, and the full JSX layout.                                         | Extract role-derived copy/scope into one small pure function or lookup (see the role-map duplication finding below), move the query wiring into a small hook (e.g. useReportsHistoryQuery), and keep the component to fetch-and-render. |              |
| 39-51,109-116 | duplication     | medium   | The role branch (lead / head / admin / viewer) is re-implemented independently four times with different shapes: usesCompiledHistory (41-42, OR-chain), searchScope (45-51, nested ternary), subtitle (109-115, nested ternary), and implicitly summaryTitle (116). Any new role or copy change has to be hunted across four sites. | Derive scope/subtitle/usesCompiledHistory from a single `ROLE_HISTORY_CONFIG` lookup keyed by role, computed once, so the role→behavior mapping lives in one place.                                                                     |              |
| 186-190       | react-patterns  | medium   | useEffect resets `showAll` to false whenever `includeArchive` changes — a classic 'adjust state on prop change' effect that fires an extra render after the prop update.                                                                                                                                                            | Reset via a `key={includeArchive}` on HistoryPanel's inner content (remounts local state), or track the previous includeArchive value and set state directly during render, per React's 'you might not need an effect' guidance.        |              |
| 21-31         | comments        | low      | 11-line header comment carries a ticket/phase tag ('UX-17 (Phase 35-08)') and a session reference ('lead-live-walk-2026-06-14 §4'), well over the 3-line no-archaeology budget.                                                                                                                                                     | Keep only the load-bearing WHY (no tab-state, archive is local-not-URL) in ≤3 lines; relocate the ticket/phase provenance to the relevant openspec spec, drop it from the code comment.                                                 |              |
| 43-44         | comments        | low      | Inline comment references a ticket/task id ('viewer-report-surface-parity (task 4.1)') — archaeology the policy says to delete, keeping only the rationale.                                                                                                                                                                         | Reword to state the WHY without the task id, e.g. 'viewer searches published, group-scoped content only.'                                                                                                                               |              |

Already good: HISTORY_INITIAL_VISIBLE is a properly named constant instead of an inline magic number; the archive checkbox and 'Show all' button both carry correct dynamic aria-labels for accessibility. Also: reuses existing shared components (LeadHistoryList, LeadHistorySidebar, LeadHistorySkeleton, SearchInput) rather than reimplementing history rendering inline.

## trends/page.tsx (4 findings)

| Lines   | Dimension       | Severity | Finding                                                                                                                                                                                             | Suggestion                                                                                                                                                                                                                                  | Your verdict |
| ------- | --------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 80-151  | size-complexity | high     | TrendsPage body is 72 lines (80-151), over the 50-line hard function cap, mixing three independent query/derivation blocks (history, velocity, comparison) with their JSX sections in one function. | Extract one small helper/hook per chart's data-derivation (e.g. useTrafficLightHistory) or a `<ChartSection query={...} guard={...} Chart={...}>` wrapper so each section's loading/guard/render triplet isn't repeated inline three times. |              |
| 14-24   | comments        | low      | 11-line header comment includes a ticket/phase tag ('ANAL-04 (Phase 30-03)'), over the 3-line budget.                                                                                               | Trim to the non-obvious WHY (client component because of the useTRPC() context seam; ssr:false for ResizeObserver) in ≤3 lines; drop the phase/ticket id.                                                                                   |              |
| 94-97   | comments        | low      | Comment explaining the latest-period-pair choice includes a dated session reference ('driver sweep 2026-06-09') — archaeology per the comment-hygiene policy.                                       | Keep the WHY (seed dates drift, so use the last two ascending periods rather than fixed dates) and drop the parenthetical date/session tag.                                                                                                 |              |
| 121-148 | duplication     | low      | The same isLoading ? <ChartSkeleton/> : data ? <Chart/> : null pattern is repeated three times (history, velocity, comparison sections) with identical structure.                                   | Factor a small `<ChartSlot isLoading={..} data={..} render={(d) => <Chart .../>} />` to collapse the three near-identical ternary blocks.                                                                                                   |              |

Already good: Clean next/dynamic + ssr:false pattern for the three Recharts components, with a shared ChartSkeleton loading state and consistent aria-labelledby section/heading pairing. Also: PERIOD_FROM/PERIOD_TO are named constants rather than inline date literals, and the type-guard helpers (isTrafficLightHistoryOutput etc.) are small, pure, and single-purpose.

## layout.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                                      | Suggestion                                                                                                                                                                                      | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 6-14  | comments  | low      | 9-line header comment carries a ticket/phase tag ('AUTH-07 (Phase 29-03)'), over the 3-line no-archaeology budget, though the rationale itself (layout only denies anonymous traffic; service layer is the real boundary) is load-bearing and worth keeping. | Trim to the load-bearing security-boundary rationale in ≤3 lines and drop the phase/ticket prefix; if the boundary split needs fuller explanation, relocate that to the relevant openspec spec. |              |

Already good: Minimal, single-purpose server component: one readonly-props type, one role-gate wrapper, no extra state.

## Rollup

**By dimension**

- comments: 9 (1 high, 1 medium, 7 low)
- size-complexity: 2 (both high)
- duplication: 3 (1 medium, 2 low)
- react-patterns: 1 (medium)
- constants: 1 (medium)

**By severity**

- high: 3
- medium: 4
- low: 9

**Top 3**

1. `page.tsx` ReportsPage — 137-line function body, nearly 3x the hard cap, mixing five concerns (size-complexity, high).
2. `latest/page.tsx` — 20-line JSDoc header full of ticket/phase archaeology, though the underlying race-recovery rationale is load-bearing and needs relocation, not deletion (comments, high).
3. `trends/page.tsx` TrendsPage — 72-line function body mixing three chart query/derivation blocks (size-complexity, high).

**Findings overlapping a PENDING openspec change**

None of the 16 kept findings overlap an item on the pending list
(unified-activity-entry, fix-manual-publish-archive-race, head-surface-parity-declutter,
responsive-compact-layout, project-activity-reporting, review-acknowledgement,
input-and-error-hardening, code-health-and-test-cleanup, fix-dashboard-nan-pending,
key-charts-by-id, fix-analytics-date-matching, harden-web-vitals-endpoint,
fix-prod-web-build-args, fix-open-redirect-next-param, tighten-code-quality-ratchet,
tighten-comment-policy, map-domain-errors, escape-org-data-script).

Note: the comment-hygiene findings (9 of the 16) are stylistically in the same
territory as `tighten-comment-policy`, but that change targets the policy
definition itself, not a per-file cleanup sweep — these findings are
independent, mechanical fixes and can be handled directly rather than folded
into that change.

## Killed by verification

- **reports/page.tsx ~252 effective lines, over the 250-line hard threshold, three components in one file (placement, medium)** — Metric refuted: actual effective count is 241 (276 total − 20 blank − 15 comment lines; the finding undercounted comments as 4). File is under the 250 threshold. The residual placement concern is already covered by the ReportsPage size-complexity finding's extraction suggestion.
- **HistoryArchiveToggle re-derives archive-toggle color tokens instead of reusing report-shell/archive-toggle.tsx (duplication, low)** — Refuted as a missed-reuse: archive-toggle.tsx's own comment documents that the toolbar switch deliberately omits a count badge ('read as a press-me call-to-action rather than a switch'), so a labeled+counted variant is an intentionally distinct control, not divergence. Both just compose the same shared CSS design tokens; nothing is re-derived. The finding's fallback suggestion (add an explanatory note) also violates the repo's no-narration comment policy.
