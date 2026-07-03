# Per-file audit — apps/web/src/components/charts (2026-07-02)

Read-only audit, wave 2 (web).
3 files reviewed.
Kept: 4 findings. Killed: 0.

## lead-velocity.chart.tsx (2 findings)

| Lines        | Dimension   | Severity | Finding                                                                                                                                                                                                      | Suggestion                                                                                                                                                                                                                                                                                                                                                                                        | Your verdict                                                                                                                                                                                                                                                                                           |
| ------------ | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| 14-21        | duplication | medium   | The 6-color hex palette (`COLORS`) is byte-for-byte duplicated in `traffic-light-history.chart.tsx` (lines 27-34). Two files independently maintain the same chart-series color scale as magic hex literals. | Extract a single named constant (e.g. `CHART_SERIES_COLORS`) into a shared chart-utils module in this folder (or `packages/ui` if other chart types will reuse it) and import it from both files.                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                        |
| 23-27, 35-63 | duplication | low      | The `ChartSeries`/`ChartData` type shapes are declared nearly identically in `traffic-light-history.chart.tsx` (lines 36-40, differing only by `                                                             | null`), and both files pivot rows into keyed data points with a similar reduce shape in their `build\*ChartData`helpers. Verified caveat: the pivot bodies are similar but not identical — lead-velocity builds a Set of leadIds plus a name map and`find`s per cell, while traffic-light-history maps rows directly and indexes `statuses[idx]`; only the type declarations are true duplicates. | If a third chart needing this pivot shape ever appears, factor the shared `ChartSeries`/`ChartData` types (and possibly a generic pivot helper) into a shared chart-utils file; with only two instances today this is a soft call — flagging for awareness rather than requiring immediate extraction. |     |

Already good: Good use of stable UUID `leadId` as the pivot/series key (not the display name) with a documented WHY comment — prevents same-named leads from colliding, and the comment stays on-topic and within budget.

## traffic-light-history.chart.tsx (1 finding)

| Lines | Dimension   | Severity | Finding                                                                           | Suggestion                                                                                             | Your verdict |
| ----- | ----------- | -------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------ |
| 27-34 | duplication | medium   | Duplicate of the `COLORS` array in `lead-velocity.chart.tsx` — see finding there. | Same as `lead-velocity.chart.tsx`: import from a shared chart-colors constant instead of re-declaring. |              |

Already good: `connectNulls={false}` plus the `STATUS_TO_VALUE` map is a clean, small, single-purpose translation with a concise comment explaining the status-to-numeric mapping; empty-state guard is simple and readable.

## period-comparison.chart.tsx (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                        | Suggestion                                                                                                                                                                                                                                                                            | Your verdict |
| ----- | --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 8-13  | comments  | low      | Header comment carries a ticket/phase reference ("ANAL-04 (Phase 30-03)") plus narration of what the code does, exceeding the 3-line no-archaeology budget and mixing load-bearing rationale (null vs zero distinction) with a change-log tag. | Delete the ANAL-04/Phase tag; keep only the one non-obvious WHY line, e.g. "Null cells render as – ; zero risk-counts render as 0 — the two are visually distinct on purpose." Relocate the ANAL-04 contract reference to the relevant openspec spec if it needs to persist anywhere. |              |

Already good: `statusLabel`/`statusColor`/`deltaClass` are small pure single-purpose helpers, easy to scan; empty-state early return keeps the table render branch simple.

## Rollup

By dimension:

- duplication: 3 (2 medium, 1 low)
- comments: 1 (low)

By severity:

- medium: 2
- low: 2

Top-3:

1. `COLORS` palette duplicated between `lead-velocity.chart.tsx` and `traffic-light-history.chart.tsx` (medium, duplication).
2. `ChartSeries`/`ChartData` type-shape duplication across the same two files (low, duplication).
3. `period-comparison.chart.tsx` header comment breaches the no-archaeology budget (low, comments).

Findings overlapping a PENDING openspec change: none. All 4 findings are local style/duplication cleanups with no match against the pending backlog (unified-activity-entry, fix-manual-publish-archive-race, head-surface-parity-declutter, responsive-compact-layout, project-activity-reporting, review-acknowledgement, input-and-error-hardening, code-health-and-test-cleanup, fix-dashboard-nan-pending, key-charts-by-id, fix-analytics-date-matching, harden-web-vitals-endpoint, fix-prod-web-build-args, fix-open-redirect-next-param, tighten-code-quality-ratchet, tighten-comment-policy, map-domain-errors, escape-org-data-script).

## Killed by verification

None — all reported findings held up under verification.
