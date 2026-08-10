import type { Action } from "../../source/contracts.ts";
import type { DomControlObservation } from "../dom-inventory.ts";

const DOM_ORDER_WIDTH = 4;

const exactControl = (
  controls: readonly DomControlObservation[],
  action: Action,
): DomControlObservation | undefined => {
  const exact = controls.find(
    ({ controlKey }) => controlKey === action.controlKey,
  );
  if (exact === undefined || action.target === undefined) return exact;
  return exact.role === action.target.role && exact.href === action.target.href
    ? exact
    : undefined;
};

const uniqueStableTarget = (
  controls: readonly DomControlObservation[],
  action: Action,
): DomControlObservation | undefined => {
  if (action.target === undefined) return undefined;
  const matches = controls.filter(
    ({ role, href }) =>
      role === action.target?.role && href === action.target.href,
  );
  const [match] = matches;
  return matches.length === 1 && match?.enabled === true ? match : undefined;
};

export const selectFrozenActionTarget = (
  controls: readonly DomControlObservation[],
  action: Action,
): DomControlObservation | undefined =>
  exactControl(controls, action) ?? uniqueStableTarget(controls, action);

export const canonicalFrozenTargetControl = (
  target: DomControlObservation,
  action: Action,
): DomControlObservation => ({
  ...target,
  controlKey: action.controlKey,
  domOrderKey: `${String(target.order).padStart(DOM_ORDER_WIDTH, "0")}:${action.controlKey}`,
});
