// lead-form-stage-access-integrity: the client-side dead-end helpers shared by
// the item, risk and decision dialogs, so all three record dialogs treat a
// zero-owned-stage product identically. The server guard
// (`validateStageOwnership`) is the real guarantee; this is convenience UX.

/**
 * The stage names a save will persist. When the lead owns exactly one stage on
 * the chosen product and has ticked nothing, that single stage is applied
 * automatically so the one-stage UX stays frictionless; otherwise the explicit
 * selection wins.
 * @param stageIds - the explicitly selected stage names
 * @param availableStages - the stages the lead owns on the chosen product
 * @returns the stage names the save should persist
 */
export function computeEffectiveStageIds(
  stageIds: readonly string[],
  availableStages: readonly string[],
): readonly string[] {
  return stageIds.length === 0 && availableStages.length === 1
    ? [...availableStages]
    : stageIds;
}

/**
 * True when the chosen product is a dead end: the lead owns zero stages on it
 * AND the row carries no stage of its own, so there is nothing to pick and the
 * dialog must not submit. A cross-stage row that already carries stageIds (its
 * product sits outside the owned list) is NOT a dead end and stays saveable.
 * @param availableStages - the stages the lead owns on the chosen product
 * @param effectiveStageIds - the stage names the save would persist
 * @returns true when Save must be disabled and the contact-admin notice shown
 */
export function isZeroOwnedStageDeadEnd(
  availableStages: readonly string[],
  effectiveStageIds: readonly string[],
): boolean {
  return availableStages.length === 0 && effectiveStageIds.length === 0;
}
