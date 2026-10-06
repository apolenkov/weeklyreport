# Design

## Context

The Overview already has the pieces: the lineage rows (`status-overview-lineage-row.tsx`), item preview and actions (`status-overview-item-preview.tsx`, `status-overview-item-actions.tsx`), a model that projects Previous/Current/Next per `stableId` (`status-overview-lineage.ts`, `status-overview-items.ts`), a prior-plan outcome command with audit events (`item-outcome.schema.ts`, `item-outcome-write.ts`), and rollover that creates carried `carriedOver: true` Current occurrences (`carry-over-automation`). The owner decision is `decision-138`; the audit and three independent designs are in the evidence directory named in the proposal. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:** a resting item with one icon and text; actions on hover, focus or tap; one-action verdicts for planned prior-week items; no new procedure, no migration; interactive elements on the first screen ≤ 35 at 1280 and 375 (visible ones), page height ≤ 60% of today's 4097 px at 1280.

**Non-Goals:** drag and drop (no library, touch and accessibility cost); a new sticky banner; changes to publish, period lifecycle or Head views; changing rollover rules.

## Decisions

1. **Verdict storage has two paths.** If a linked Current/Next occurrence exists (the normal case after rollover) the verdict is an ordinary item save of that occurrence, which can clear `carriedOver`, set status or move it to Next. If none exists the verdict uses the existing prior-plan outcome command (`source: prior`), which already audits and rejects stale sources. _Alternative:_ only the outcome command — rejected: the server refuses it when a Current occurrence already exists (`item-outcome-source.ts`), so it would not cover the main flow.
2. **No batch procedure.** `Confirm all as continue` is one section save that clears `carriedOver` on N occurrences; `save-section.item-resolutions.ts` already allows it. _Alternative:_ a new `resolvePlanBatch` procedure — rejected as unnecessary surface.
3. **Paused, not blocked.** A paused verdict is `workflowStatus: paused` with `pausedReason` (the schema's CHECK needs a reason); the outcome command cannot express it, so the item-save path is used. "Blocked" stays the risk-derived health term (`record-status-derivation`).
4. **Continue keeps `planned`.** Confirming a suggested continuation only clears the marker; it does not promote to `in_progress`, matching what rollover writes.
5. **Submit blocking reuses `UNCONFIRMED_CARRIED_ITEM`.** Only the counter text changes; no new blocker. The end-of-form explanation stays in flow (spec `lead-completion-guidance`); the sticky cluster gets the `n to review` indicator.
6. **Reveal without removing from the tree.** Hover actions use `focus-within` and opacity/size transitions, never `display: none`; on touch the tap target toggles a visible state. The 44 px target rule (`ui-control-density`) still applies to every revealed control.
7. **Collapse, do not delete, earlier open work.** The register is part of the tracked-work contract (Paused work); it becomes one disclosure line. _Alternative:_ remove it — rejected: unscheduled planned work would lose its only place.
8. **Health block becomes a summary line**, expanding to the existing inspection. No new data.

## Risks / Trade-offs

- Hidden actions are less discoverable → quick week-move icon stays at rest on the row end on touch; tooltips on first focus; acceptance checks keyboard and 375.
- Stricter Submit delays Head review → documented; `Confirm all as continue` keeps the cost to one action.
- Large test churn (e2e overview/completion/navigation, ~90 unit tests) → tasks update tests in the same group as each UI change, not at the end.
- Demo seed does not run rollover, so the linked path is untested in the browser → add a carried-item fixture (already present in `e2e/lead-form/overview.test.ts`) to acceptance.
- Previous shows only items with a commitment for the selected week; verdicts follow that scope, so "every prior result" is intentionally not asked.
