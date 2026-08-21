import { sha256Hex } from "../../../support/ids.ts";
import type { RevealSurface, RevealSurfaceControl } from "../../reveal-path.ts";

type RevealSurfaceMaterialControl = Readonly<
  Pick<
    RevealSurfaceControl,
    | "controlKey"
    | "ariaRole"
    | "accessibleName"
    | "enabled"
    | "href"
    | "interactionEffect"
    | "ariaControls"
    | "ariaExpanded"
    | "disclosureIndependence"
    | "keyboardFocusScope"
  >
>;

export type RevealSurfaceMaterial = Readonly<{
  readonly controls: readonly RevealSurfaceMaterialControl[];
  readonly digest: string;
}>;

const compareRevealSurfacePosition = (
  left: RevealSurfaceControl,
  right: RevealSurfaceControl,
): number => {
  if (left.order < right.order) return -1;
  if (left.order > right.order) return 1;
  return (
    left.domOrderKey.localeCompare(right.domOrderKey) ||
    left.controlKey.localeCompare(right.controlKey)
  );
};

const revealSurfaceMaterialControlFor = (
  control: RevealSurfaceControl,
): RevealSurfaceMaterialControl => ({
  controlKey: control.controlKey,
  ariaRole: control.ariaRole,
  accessibleName: control.accessibleName,
  enabled: control.enabled,
  href: control.href,
  interactionEffect: control.interactionEffect,
  ...(control.ariaControls === undefined
    ? {}
    : { ariaControls: control.ariaControls }),
  ...(control.ariaExpanded === undefined
    ? {}
    : { ariaExpanded: control.ariaExpanded }),
  ...(control.disclosureIndependence === undefined
    ? {}
    : { disclosureIndependence: control.disclosureIndependence }),
  ...(control.keyboardFocusScope === undefined
    ? {}
    : { keyboardFocusScope: control.keyboardFocusScope }),
});

export const revealSurfaceMaterialFor = (
  surface: RevealSurface,
): RevealSurfaceMaterial => {
  const controls = surface.controls
    .toSorted(compareRevealSurfacePosition)
    .map(revealSurfaceMaterialControlFor);
  return { controls, digest: sha256Hex(controls) };
};

export const sameRevealSurfaceMaterial = (
  left: RevealSurface,
  right: RevealSurface,
): boolean =>
  revealSurfaceMaterialFor(left).digest ===
  revealSurfaceMaterialFor(right).digest;
