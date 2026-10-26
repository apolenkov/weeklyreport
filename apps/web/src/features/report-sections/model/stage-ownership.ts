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

export interface InitialStageNamesArgs {
  readonly isCreate: boolean;
  // Stages stored on the record being edited; never replaced by a default.
  readonly storedStageNames?: readonly string[] | undefined;
  // Contextual prefill (e.g. a chip-raise): a deliberate choice, so it wins.
  readonly explicitStageNames?: readonly string[] | undefined;
  // The last stage saved for this product in this draft, when one is known.
  readonly rememberedStageName?: string | undefined;
  // Stages the section author owns on the selected product.
  readonly availableStages: readonly string[];
}

// One editable selector default. Whereas `computeEffectiveStageNames` keeps the
// sole-owned-stage shortcut at render time, this resolves the initial state so a
// reopen shows the same correctable choice. Editing always restores stored
// stages; a remember only ever adds one stage the author still owns.
export function resolveInitialStageNames(
  args: InitialStageNamesArgs,
): readonly string[] {
  if (!args.isCreate) return [...(args.storedStageNames ?? [])];
  const explicit = args.explicitStageNames ?? [];
  if (explicit.length > 0) return [...explicit];
  if (
    args.rememberedStageName !== undefined &&
    args.availableStages.includes(args.rememberedStageName)
  ) {
    return [args.rememberedStageName];
  }
  return args.availableStages.length === 1 ? [...args.availableStages] : [];
}
