# Proposal

## Why

A Lead currently creates an Overview item from the unit's left header, then chooses a week in a modal. This obscures the week and owner already visible in the grid. The same weekly workflow needs quick, contextual entry of items, risks and decisions, while detailed editing remains available. Previously planned work must be continued in the current report without modifying the frozen earlier report. The comments icon currently has no visible empty-state response, and the overview’s per-record icons, answer buttons and side rail make rows hard to read.

## What Changes

- Restructure the Overview to the three-week grid of mockup v2.5: one row per work item traced Last week, This week, Next week; one quiet entry line per unit and week; one line per record with a status icon, a clickable stage label and a conditional discussion count; an in-place editor opened by clicking the text, with the full form as a modal Sheet.
- Place quick item creation within each editable Current and Next context for a Product or Activity, opening an inline editor with the correct owner and week. Retain the existing full editor for detailed edits and existing global creation flows where applicable.
- Offer minimum-input inline risk and decision drafts under `lead-incomplete-record-drafts` (TASK-836), retaining explicit parent, owned stages, severity and authoritative owner. Missing details are null; only a matching receipt confirms “saved draft — needs details”. Complete or explicitly delete before section submit.
- Answer a previous plan through the status icon of its one line in This week (Done, In progress, Next week, Paused…, Won’t do…); no separate answer buttons, `Confirm all`, `from plan` badge or per-record pencil, move and discussion buttons. Make it clear that an answer updates the selected week's occurrence, not the previous snapshot. Reuse existing verdicts, stable identity, duplicate prevention and conflict handling, re-check the target week before every answer, move and Undo, and keep one Undo rule.
- Show a discussion icon on a record only when it has comments, with the count; open an accessible Discussion Sheet from the icon or from `Discussion (N)` in the editor, including an empty state and a Lead reply on their own eligible item, with server-enforced ownership and lifecycle rules.
- Preserve unsaved inline text and a truthful conflict indication across refetch; retain newer server data until explicit reconciliation.
- Show `+ Risk or decision` and the counts `N risks · M decisions` in each unit header, and one `Before you submit` list of blockers at the end of the report, each routed to its unit.
- Preserve keyboard, touch, 375px layout (week tabs below about 1087 px), focus, pending/error recovery and read-only/foreign behavior.

## Capabilities

### New Capabilities

- `lead-overview-save-safety`: One Undo rule, unsaved input that blocks Submit and is never lost, one `Before you submit` list, and modal Sheets and alert dialogs.
- `lead-overview-responsive-shell`: One quiet report header and week tabs on narrow tables.
- `lead-contextual-quick-entry`: Inline creation of items, risks and decisions in their permitted owner and week contexts.
- `lead-item-comment-access`: Discoverable record discussion and authorized Lead replies to their own eligible items.

### Modified Capabilities

- `lead-status-overview`: One row per work item in three equal columns, the record line, Last week and Next week behaviour, the quiet header and week tabs; replaces the hover, left-rail and linked/loose rules.
- `lead-status-overview-actions`: Replace header-only modal creation with inline entry, the in-place editor, status menus and stage selection.
- `lead-plan-verdict`: Answer a plan through its status icon, re-check the target week before every answer, and continue a frozen Previous commitment without editing history or duplicating lineage.
- `lead-overview-week-moves`: Week moves through the status menu, the editor and Alt+Arrow shortcuts, with an impossible move kept disabled with its reason.
- `lead-form-draft-orchestration`: Make unsaved inline text visibly recoverable after a stale-version conflict.

## Impact

Lead Overview and record sections in `apps/web`, scoped Lead comment authorization and message persistence in `apps/api` and shared contracts, their focused and E2E tests, and OpenSpec. Existing lifecycle and authorization boundaries remain authoritative; backend changes require explicit scenarios and checks. The viewing stand remains separate from the implementation worktree.
