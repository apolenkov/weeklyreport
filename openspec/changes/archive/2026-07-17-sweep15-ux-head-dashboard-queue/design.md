## Context

`DashboardPage` currently renders `ActivityLivePanel`, `LeadSummaryTable`, and `SectionReviewStrip` as three lead rosters. Each exposes a different subset of freshness, content, reminder, revoke, and verdict actions. This redesign follows the durable `head-dashboard-clarity` capability and the P1 `sweep15-dashboard-draft-drilldown` fix, preserving its content-bearing draft Open behavior while consolidating the roster. KPI/reopen/escalation blocks remain.

## Goals / Non-Goals

**Goals:** give the head one scan-to-action queue per lead, preserve every unique signal/action, reduce repeated names, and make bulk revoke clearly secondary.

**Non-Goals:** create new workflow states/procedures, change authorization, merge reopen requests or risk escalations into lead rows, or add activity escalation.

## Decisions

### 1. Period Summary is the canonical roster

Rename the component internally if useful, but keep the user-facing heading "Period Summary". One row/card per lead contains:

- identity and role;
- submission state (`Not started`, `In progress`, `Submitted`, plus review verdict where present);
- freshness (`lastEditAt`/submitted time, including stale treatment only for open work);
- compact content counts and worst attention signal;
- one primary contextual action and a small secondary menu when multiple actions apply.

Rows are ordered by action need: requested changes/reviewable submissions, stale drafts/not-started, active drafts, then completed/approved; stable name order breaks ties.

### 2. Expansion holds detail, not a second page

Expanding a row reveals product/activity content counts, recent submission/edit detail, review verdict/history summary, and the full contextual action set. It does not render the full report body. `Open` navigates to the existing report/section destination; `Review` opens the existing review-capable report surface.

### 3. Actions reuse existing gates

- Open: content-bearing rows, including drafts.
- Remind: open draft/not-started row only when `canSendReminder` is true.
- Review / Request Changes: only when `canReview` and current verdict rules permit.
- Revoke: submitted section in a non-published period.

Request Changes uses the existing review mutation (which may unsubmit); Revoke uses the existing explicit revoke mutation. Controls remain distinct and invalidate/refetch the same query keys.

### 4. Remove duplicated rosters after migrating unique signals

Delete standalone `Submission Activity` and `SectionReviewStrip` roster rendering once their freshness and verdict data are mapped into queue rows. If activity contains non-lead operational events, retain only a collapsed event feed that is not another per-lead roster. KPI cards, AlertBar aggregate state (without another lead list), Reopen Requests, and Blocked & At Risk remain.

### 5. Revoke All becomes secondary

Move Revoke All from the prominent header action to an overflow/bulk-actions area below normal queue actions. Keep its confirmation and authorization unchanged, and do not show it as the default next step.

### 6. Loading and accessibility

Rows support button/summary expansion with correct `aria-expanded`/`aria-controls`, keyboard access, and stable focus after mutations. Queue data can show local readiness per `sweep15-web-perf-practices`; this redesign does not restore a page-wide query barrier.

## Risks / Trade-offs

- [Queue row becomes overloaded] → Keep summary compact and place secondary data/actions in expansion.
- [Signals disappear when old panels are removed] → Maintain a source-to-destination inventory and tests for every Activity/Review field/action.
- [Action ordering surprises heads] → Encode a pure priority function with fixture coverage and preserve stable tie order.
- [Concurrent review/revoke changes state] → Reuse server gates and refetch queue sources after mutation.

## Migration Plan

Build the combined queue model and render it alongside old panels in tests only, prove parity, switch production composition, then delete/collapse duplicate rosters and de-emphasize Revoke All. No data migration or flag is required.

## Open Questions

None; Period Summary is selected as the canonical queue.
