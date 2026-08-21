import {
  type RevealSurfaceControl,
  surfaceSignatureFor,
} from "../../preflight/reveal-path.ts";
import {
  domControlDisclosureMetadataFor,
  type DomInventory,
} from "../dom/dom-inventory.ts";
import { FrozenRevealReplayError } from "./frozen-reveal-replay-error.ts";

export const assertFrozenRevealTarget = (
  inventory: DomInventory,
  expected: RevealSurfaceControl,
): RevealSurfaceControl => {
  const actual = inventory.controls.find(
    ({ controlKey }) => controlKey === expected.controlKey,
  );
  if (actual === undefined)
    throw new FrozenRevealReplayError(
      `Frozen reveal target is missing: ${expected.controlKey}`,
    );
  const surfaceControl = {
    controlKey: actual.controlKey,
    ariaRole: actual.role,
    accessibleName: actual.accessibleName,
    enabled: actual.enabled,
    order: actual.order,
    domOrderKey: actual.domOrderKey,
    href: actual.href,
    interactionEffect: actual.interactionEffect ?? null,
    ...domControlDisclosureMetadataFor(actual),
  } satisfies RevealSurfaceControl;
  if (surfaceControl.enabled !== expected.enabled)
    throw new FrozenRevealReplayError(
      `Frozen reveal target enabled drift for ${expected.controlKey}`,
    );
  if ((surfaceControl.href ?? "") !== (expected.href ?? ""))
    throw new FrozenRevealReplayError(
      `Frozen reveal target href drift for ${expected.controlKey}`,
    );
  if (surfaceSignatureFor(surfaceControl) !== surfaceSignatureFor(expected))
    throw new FrozenRevealReplayError(
      `Frozen reveal target signature drift for ${expected.controlKey}`,
    );
  return surfaceControl;
};
