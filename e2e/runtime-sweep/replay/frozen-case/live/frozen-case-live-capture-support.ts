import type { ActionOutcome } from "./frozen-case-live-actions.ts";
import type { FrozenPhaseInput } from "./frozen-case-live-capture-types.ts";

export const publishActionTarget = (
  input: FrozenPhaseInput,
  outcome: ActionOutcome | undefined,
): void => {
  if (input.phase !== "action") return;
  input.onActionTarget?.(outcome?.target);
};

export const phaseStartedAtFor = (input: FrozenPhaseInput): string =>
  input.phase === "before"
    ? input.initialEvents.startedAt
    : new Date().toISOString();
