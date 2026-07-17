## Why

The head dashboard repeats the same leads across Period Summary, Submission Activity, and Review, forcing the head to reconcile three rosters before acting. The P2 product review calls for one canonical per-lead work queue while KPI cards remain summary context.

## What Changes

- Redesign Period Summary as the canonical expandable per-lead action queue, with compact state/freshness/content summaries and expanded detail.
- Offer only context-valid actions: Open, Remind, Review, Request Changes, and Revoke, reusing existing authorization and mutation gates.
- Fold the duplicated Submission Activity and Review rosters into queue rows (or remove them once their unique detail is represented); retain non-roster KPI, reopen-request, and blocked/at-risk summaries.
- De-emphasize Revoke All as a secondary bulk/destructive action.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `head-dashboard-clarity`: Period Summary becomes the single lead action queue and duplicate rosters are removed.

## Impact

Touches dashboard mapping/composition, `LeadSummaryTable`, activity/review roster integration, actions, tests, and catalog/visual coverage. It follows `sweep15-dashboard-draft-drilldown`; content-bearing draft Open behavior is migrated into the canonical queue rather than re-specified as an Activity panel fix. Existing tRPC procedures and authorization remain unchanged.

## Non-goals

- No new workflow states, review verdicts, reminder rules, or bulk mutation.
- No removal of KPI cards, reopen requests, or Blocked & At Risk.
- No activity-scoped escalation; that finding remains deferred.
