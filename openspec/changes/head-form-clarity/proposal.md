# Head form clarity

## Why

Head loses record detail and section context while reviewing Activities, and the queue's Review action opens Read instead. Inconsistent Paused styling and misleading form labels add avoidable interpretation work before a verdict.

Source: the complete static review at `/home/user/.local/state/external-worker/2026-11-03T05-55-46-499Z-cpa_gpt-6.1-sol.log`, findings 2, 7, 4, 8 and 9; verified against the current worktree sources named in design.md. The review is static evidence, not browser acceptance.

## What Changes

- Retain a compact Activity summary and disclose typed Current, Next, risk and decision records with Product-equivalent reading and review depth.
- Place section verdict actions beside their Lead section; provide targeted navigation from the Product-scope review roster without duplicating mutation controls.
- Give queue Review links an explicit, capability-checked review intent; preserve ordinary Open and submitted-only defaults.
- Use one neutral Paused progress presentation in Lead Overview and Head form, separate from risk alarms.
- Name the Head views Report / Slides and use lifecycle-neutral Portfolio report context copy.

### Non-goals

- No Lead authoring editors on Head, predecessor columns, new review permissions, API endpoints, schema/storage changes, lifecycle transitions or PDF/slide-content redesign.
- No automatic Show all for draft Open links, lifecycle badge recoloring, or reimplementation of the review findings already delivered outside these five items.

## Capabilities

### New Capabilities

None; reuse the existing capability owners.

### Modified Capabilities

- `weekly-activity-presentation`: typed Activity detail, review parity and unavailable-details preservation.
- `review-verdict-integrity`: section-local verdict placement and targeted roster navigation.
- `head-dashboard-clarity`: distinguish focused Open and Review targets.
- `report-routing`: guarded Head review deep-links and navigation semantics.
- `status-presentation-model`: shared Paused progress semantics without extending the canonical health union.
- `head-surface-parity`: accurate Head view/context labels.
- `report-toolbar-layout`: replace the literal Head Edit/Slides wording while preserving layout.
- `ui-control-density`: retain touch geometry under the revised view labels.

## Impact

Web-only implementation across `features/report-sections`, `features/report-pages`, `features/review`, `features/dashboard`, and shared report-shell/status/navigation code, with colocated tests and browser journey coverage. Existing `review.comment`, comment deletion and `review.verdict` contracts remain authoritative; no API, Prisma, dependencies, feature flag or migration is required. This change contains planning artifacts only.
