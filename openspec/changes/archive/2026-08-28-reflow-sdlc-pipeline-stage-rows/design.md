## Context

The proposal changes only the presentation layer of the lead SDLC pipeline. `deriveProductPipelineView` already supplies the ordered visible stages, raw status, ownership, hidden-stage reveal, risk-derived colors, and completeness data; `SdlcProductCard` composes that view and `StageChip` owns the existing accessible interaction. No request, persistence, or shared-schema path is involved.

## Goals / Non-Goals

**Goals:**

- Make the visible stage list a stable vertical stack of full-width rows.
- Keep one control and one status source per stage: the existing `StageChip` remains the interactive element and continues to use the derived status.
- Improve scanning with the existing stage icon plus a right-aligned status glyph, while preserving the current tooltip, lock badge, coverage distinction, and assignee label.
- Keep long labels inside the card with `min-w-0`, truncation, and a left-aligned label area.
- Preserve Mine/Everyone filtering, the collapsed-stage indicator, risk health, and own-input completeness.

**Non-Goals:**

- No API, database, permissions, stage-order, status-derivation, or ownership changes.
- No new dependency, feature flag, mobile-specific redesign, or change to the product-card health stripe.
- No claim that this presentation change completes CR-001 runtime or release acceptance.

## Decisions

1. **Use the existing stage control as the full-width row.** `StagesRow` will become a vertical `w-full` stack and `StageStep` will be a `w-full` wrapper around `StageChip`. This avoids duplicating the stage label, status, or click semantics in a second control. A separate label column was considered, but it would duplicate text and create two visual targets for one stage.

2. **Remove horizontal arrows.** The old arrows communicate adjacency in a single-line strip and become misleading once stages are rows. Removing them is safer than introducing a decorative connector that could be mistaken for a status signal; the stage icon and status glyph provide the visual scan path. The old arrow-only height token remains available to the collapsed indicator and chip geometry.

3. **Make the chip itself readable at row width.** The button keeps its fixed minimum height and status-colored background/border, changes to left-aligned content, truncates the label only inside a `min-w-0` span, and adds the existing `STATUS_CONFIG` glyph at the end as a decorative visual cue. The button's existing `aria-label` and tooltip remain authoritative for non-visual status information.

4. **Keep row geometry deterministic.** The wrapper uses `w-full min-w-0` and a fixed vertical gap; the chip retains `STAGE_CHIP_BOX_HEIGHT`. No render-time layout reads or `transition-all` are introduced. Hover/focus styles remain on the semantic button and the status glyph is `aria-hidden`.

5. **Test the contract at the component boundary.** Replace horizontal-arrow structural assertions with tests for one `data-testid="sdlc-stage-row"` per visible stage, full-width row/chip classes, status glyph presence, and unchanged Mine/Everyone and interaction cases. Add a focused long-label assertion so overflow protection is explicit.

## Risks / Trade-offs

- [Risk] A very narrow viewport may still have less room for a long stage label. → Mitigation: `min-w-0`, `truncate`, left alignment, and the existing responsive touch-target minimum; verify a narrow desktop viewport in screenshots.
- [Risk] Removing arrows could reduce the perceived order of stages. → Mitigation: preserve canonical array order, add stable vertical spacing, and keep the stage-specific icons; review the whole card rather than the component in isolation.
- [Risk] Adding a status glyph could be read as a second status source. → Mitigation: derive it directly from the same `STATUS_CONFIG[stage.status]` value used for the fill/border and mark it decorative; the accessible label/tooltip remains the single semantic status channel.
- [Risk] Existing snapshots or structural tests may encode the horizontal strip. → Mitigation: update only focused pipeline assertions and run the affected Vitest suite plus typecheck/lint for changed files.

## Migration Plan

1. Apply the presentation and focused-test changes in one source commit; no migration or rollout flag is needed.
2. Run the affected tests, TypeScript, lint, and a diff review.
3. Capture fresh real-Chrome before/after screenshots on the exact source SHAs, checking whole-frame composition, no-jump geometry, `scrollY`, and top-menu visibility. Obtain an independent visual review and a Sol review before acceptance.
4. Roll back by reverting the single UI commit if visual review finds a regression; no data or runtime cleanup is required.

The period dual-state, role-coverage gate, destructive database guard, and deferred-feature pattern are preserved and not touched by this change.

## Open Questions

None. The requested row layout and status visualization are specific enough to implement without changing the contract.
