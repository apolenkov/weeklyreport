import type { Action } from "../../../source/contracts.ts";
import type { DomInventory } from "../../dom/dom-inventory.ts";
import { inventoryDom } from "../../dom/dom-inventory.ts";
import type { ActionOutcome } from "../live/frozen-case-live-action-control.ts";
import type { FrozenPhaseInput } from "../live/frozen-case-live-capture-types.ts";
import {
  frozenActionBeforeIssues,
  resolveFrozenActionTransition,
} from "./frozen-action-transition-validation.ts";

export const frozenActionBoundaryOutcome = async (
  input: FrozenPhaseInput,
  action: Action | undefined,
): Promise<ActionOutcome | undefined> => {
  const transition =
    input.phase === "action" && action !== undefined
      ? resolveFrozenActionTransition(input.source, input.matrixCase)
      : undefined;
  if (transition === undefined || action === undefined) return undefined;
  const inventory: DomInventory = await inventoryDom(input.page);
  const issues = frozenActionBeforeIssues(input.source, input.matrixCase, {
    inventory,
    url: input.page.url(),
  });
  return issues.length === 0
    ? undefined
    : {
        status: "ambiguous",
        controlKey: action.controlKey,
        reason: issues.join("; "),
      };
};
