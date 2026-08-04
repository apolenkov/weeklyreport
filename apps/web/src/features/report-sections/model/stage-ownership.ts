// lead-form-stage-access-integrity: the client-side dead-end helpers shared by
// the item, risk and decision dialogs, so all three record dialogs treat a
// zero-owned-stage product identically. The server guard
// (`validateStageOwnership`) is the real guarantee; this is convenience UX.

// Auto-select the sole owned stage when nothing is selected; explicit choices
// always win.
export function computeEffectiveStageNames(
  stageNames: readonly string[],
  availableStages: readonly string[],
): readonly string[] {
  return stageNames.length === 0 && availableStages.length === 1
    ? [...availableStages]
    : stageNames;
}

// A product is a dead end only when it has no owned stages and the row carries
// no existing stage to preserve.
export function isZeroOwnedStageDeadEnd(
  availableStages: readonly string[],
  effectiveStageNames: readonly string[],
): boolean {
  return availableStages.length === 0 && effectiveStageNames.length === 0;
}
