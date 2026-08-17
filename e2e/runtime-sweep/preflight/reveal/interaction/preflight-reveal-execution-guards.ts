import type { Action } from "../../../source/contracts.ts";
import { stableSerialize } from "../../../support/ids.ts";
import type { RevealPath } from "../../reveal-path.ts";
import type { RevealRepresentativeInput } from "./preflight-reveal-transition.ts";
import { RevealDiscoveryError } from "./preflight-reveal-types.ts";

export const assertRepresentativeInput = (
  action: Action,
  expected: RevealRepresentativeInput | undefined,
  actual: RevealRepresentativeInput | undefined,
): void => {
  const formAction =
    action.operation === "fill" || action.operation === "select";
  if (!formAction) {
    if (actual !== undefined)
      throw new RevealDiscoveryError(
        `Non-form reveal returned a representative input: ${action.controlKey}`,
      );
    return;
  }
  if (expected === undefined || actual === undefined)
    throw new RevealDiscoveryError(
      `Form reveal lacks a frozen representative input: ${action.controlKey}`,
    );
  if (stableSerialize(expected) !== stableSerialize(actual))
    throw new RevealDiscoveryError(
      `Form reveal representative input drifted: ${action.controlKey}`,
    );
};

export const actionFromStep = (step: RevealPath["steps"][number]): Action => {
  const {
    before: _before,
    after: _after,
    beforeUrl: _beforeUrl,
    afterUrl: _afterUrl,
    nonMutation: _nonMutation,
    representativeInput: _representativeInput,
    ...action
  } = step;
  return action;
};
