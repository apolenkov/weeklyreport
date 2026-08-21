import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
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

type MaterialControl = RevealSurfaceMaterial["controls"][number];
type MaterialBranchView = Readonly<{ readonly surface: RevealSurface }>;

const SOURCE_BOUND_ROW_LOCAL = "source-bound-row-local" as const;

const materialIdentityFor = (control: MaterialControl): string =>
  control.disclosureIndependence === SOURCE_BOUND_ROW_LOCAL &&
  typeof control.ariaControls === "string" &&
  control.ariaControls.length > 0
    ? `aria-controls:${control.ariaControls}`
    : `control-key:${control.controlKey}`;

const materialSignatureFor = (control: MaterialControl): string =>
  stableSerialize(
    control.disclosureIndependence === SOURCE_BOUND_ROW_LOCAL &&
      typeof control.ariaControls === "string" &&
      control.ariaControls.length > 0
      ? {
          ...control,
          controlKey: materialIdentityFor(control),
          accessibleName: "source-bound-disclosure",
        }
      : control,
  );

interface MaterialUnionState {
  readonly controls: Map<string, MaterialControl>;
  readonly changed: Map<string, string>;
}

const materialControlsByKeyFor = (
  material: RevealSurfaceMaterial,
): ReadonlyMap<string, MaterialControl> =>
  new Map(
    material.controls.map((control) => [materialIdentityFor(control), control]),
  );

const rootOrderIsStable = (
  root: RevealSurfaceMaterial,
  actual: RevealSurfaceMaterial,
): boolean => {
  const rootKeys = root.controls.map(materialIdentityFor);
  const actualRootKeys = actual.controls
    .map(materialIdentityFor)
    .filter((identity) => rootKeys.includes(identity));
  return stableSerialize(actualRootKeys) === stableSerialize(rootKeys);
};

const mergeMaterialControl = (
  state: MaterialUnionState,
  control: MaterialControl,
): boolean => {
  const signature = materialSignatureFor(control);
  const identity = materialIdentityFor(control);
  const current = state.controls.get(identity);
  if (current !== undefined && materialSignatureFor(current) === signature)
    return true;
  const previousChange = state.changed.get(identity);
  if (previousChange !== undefined && previousChange !== signature)
    return false;
  state.changed.set(identity, signature);
  state.controls.set(identity, control);
  return true;
};

const mergeSingleMaterial = (
  state: MaterialUnionState,
  root: RevealSurfaceMaterial,
  single: MaterialBranchView,
): boolean => {
  const material = revealSurfaceMaterialFor(single.surface);
  const rootControlsByKey = materialControlsByKeyFor(root);
  const controlsByKey = materialControlsByKeyFor(material);
  if (
    !root.controls.every((control) =>
      controlsByKey.has(materialIdentityFor(control)),
    )
  )
    return false;
  return material.controls.every((control) => {
    const rootControl = rootControlsByKey.get(materialIdentityFor(control));
    return rootControl !== undefined &&
      materialSignatureFor(rootControl) === materialSignatureFor(control)
      ? true
      : mergeMaterialControl(state, control);
  });
};

const unionMaterialFor = (
  root: RevealSurfaceMaterial,
  singles: readonly MaterialBranchView[],
): ReadonlyMap<string, MaterialControl> | undefined => {
  const state: MaterialUnionState = {
    controls: new Map(
      root.controls.map((control) => [materialIdentityFor(control), control]),
    ),
    changed: new Map(),
  };
  return singles.every((single) => mergeSingleMaterial(state, root, single))
    ? state.controls
    : undefined;
};

export const matchesUnion = (input: {
  readonly root: RevealSurfaceMaterial;
  readonly singles: readonly MaterialBranchView[];
  readonly actual: RevealSurfaceMaterial;
}): boolean => {
  const expected = unionMaterialFor(input.root, input.singles);
  if (!expected) return false;
  if (
    input.actual.controls.length !== expected.size ||
    !rootOrderIsStable(input.root, input.actual)
  )
    return false;
  return input.actual.controls.every((control) => {
    const expectedControl = expected.get(materialIdentityFor(control));
    return (
      expectedControl !== undefined &&
      materialSignatureFor(expectedControl) === materialSignatureFor(control)
    );
  });
};
