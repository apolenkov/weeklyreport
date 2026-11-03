# Proposal

## Why

A Lead currently creates an Overview item from the unit's left header, then chooses a week in a modal. This obscures the week and owner already visible in the grid. The same weekly workflow needs quick, contextual entry of items, risks and decisions, while detailed editing remains available. Previously planned work must be continued in the current report without modifying the frozen earlier report. The comments icon currently has no visible empty-state response.

## What Changes

- Place quick item creation within each editable Current and Next context for a Product or Activity, opening an inline editor with the correct owner and week. Retain the existing full editor for detailed edits and existing global creation flows where applicable.
- Offer inline contextual risk and decision creation, retaining their required fields, explicit parent and owned-stage rules; never pretend an incomplete record was saved.
- Make it clear that actions on a previous plan update the selected week's occurrence, not the previous snapshot. Reuse existing verdicts, stable identity, duplicate prevention and conflict handling.
- Make the item comments control open an accessible discussion, including an empty state and a Lead reply on their own eligible item, with server-enforced ownership and lifecycle rules.
- Preserve keyboard, touch, 375px layout, focus, pending/error recovery and read-only/foreign behavior.

## Capabilities

### New Capabilities

- `lead-contextual-quick-entry`: Inline creation of items, risks and decisions in their permitted owner and week contexts.
- `lead-item-comment-access`: Discoverable record discussion and authorized Lead replies to their own eligible items.

### Modified Capabilities

- `lead-status-overview-actions`: Replace header-only modal creation with week-context inline entry while retaining detailed modal edit and safe dismissal.
- `lead-plan-verdict`: Clarify how a frozen Previous commitment is continued into the selected week without editing history or duplicating lineage.

## Impact

Lead Overview and related record sections in `apps/web`, their focused and E2E tests, and OpenSpec. Existing report schemas, authorization and persistence are authoritative; backend or shared-contract changes require evidence and explicit scenarios rather than silent defaults. The viewing stand remains separate from the implementation worktree.
