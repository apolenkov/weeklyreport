import type { RevealSurface } from "../../preflight/reveal-path.ts";
import type { Action } from "../../source/contracts.ts";
import { stableSerialize } from "../../support/ids.ts";
import type { MatrixPreflightControl } from "../finalization/matrix-finalizer-contract.ts";
import { MatrixFinalizationError } from "../finalization/matrix-finalizer-contract.ts";
import { parseRevealTransition } from "../reveal-transition.ts";

export const actionRequiresFrozenTransition = (
  action: Action | undefined,
  expectedSurface?: RevealSurface,
): boolean =>
  action !== undefined &&
  expectedSurface?.controls.find(
    ({ controlKey }) => controlKey === action.controlKey,
  )?.interactionEffect !== "mutation-required" &&
  ((action.operation === "click" &&
    action.safety === "read-only" &&
    action.target === undefined &&
    ["none", "open", "cancel"].includes(action.transition)) ||
    ((action.operation === "fill" || action.operation === "select") &&
      action.safety === "irreversible" &&
      action.transition === "none"));

const requireInvariant = (condition: boolean, message: string): void => {
  if (!condition) throw new MatrixFinalizationError(message);
};

export const assertControlTransition = (
  control: MatrixPreflightControl,
): void => {
  const transition = control.expectedActionTransition;
  const actionSurface = control.expectedActionSurface;
  requireInvariant(
    !actionRequiresFrozenTransition(control.action, control.expectedSurface) ||
      transition !== null,
    `Reveal action ${control.controlKey} has no frozen transition`,
  );
  requireInvariant(
    (transition === null) === (actionSurface === null),
    `Reveal action ${control.controlKey} transition and surface must be paired`,
  );
  if (transition === null || actionSurface === null) return;
  const parsed = parseRevealTransition(transition);
  requireInvariant(
    control.action !== undefined &&
      stableSerialize(parsed.action) === stableSerialize(control.action),
    `Reveal action ${control.controlKey} transition does not match its action`,
  );
  requireInvariant(
    parsed.beforeSurfaceDigest === control.expectedSurface.digest,
    `Reveal action ${control.controlKey} transition starts from the wrong surface`,
  );
  requireInvariant(
    parsed.afterSurfaceDigest === actionSurface.digest,
    `Reveal action ${control.controlKey} transition ends at the wrong surface`,
  );
  requireInvariant(
    parsed.nonMutation.beforeDigest === parsed.nonMutation.afterDigest,
    `Reveal action ${control.controlKey} transition mutated the database oracle`,
  );
};
