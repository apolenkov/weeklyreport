import type {
  RevealPath,
  RevealSurface,
  RevealSurfaceControl,
} from "../../reveal-path.ts";
import type {
  RevealBranch,
  RevealDiscoveryState,
} from "../interaction/preflight-reveal-branches.ts";

const SOURCE_BOUND_ROW_LOCAL = "source-bound-row-local" as const;

export type BranchView = Readonly<
  Pick<RevealBranch, "path" | "surface" | "url">
>;

const SCOPED_DISCLOSURE_TRANSITIONS = new Set(["none", "open", "cancel"]);

export type ToggleBinding = Readonly<{
  readonly identity: string;
  readonly targetId: string;
}>;

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

const sourceControlFor = (
  surface: RevealSurface,
  controlKey: string,
): RevealSurfaceControl | undefined =>
  surface.controls.find((control) => control.controlKey === controlKey);

const hasModalOrBackgroundControl = (surface: RevealSurface): boolean =>
  surface.controls.some(
    ({ keyboardFocusScope }) =>
      keyboardFocusScope === "active-modal" ||
      keyboardFocusScope === "background",
  );

const isSourceBoundDisclosure = (
  control: RevealSurfaceControl | undefined,
): control is RevealSurfaceControl =>
  control?.ariaRole === "button" &&
  control.enabled &&
  control.interactionEffect !== "mutation-required" &&
  control.disclosureIndependence === SOURCE_BOUND_ROW_LOCAL;

const hasValidTargetId = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.length > 0 && !/\s/u.test(value);

const sourceBoundIdentityFor = (targetId: string): string =>
  `source-bound-target:${targetId}`;

const sequenceKeyForStep = (step: RevealPath["steps"][number]): string => {
  const source = sourceControlFor(step.before, step.controlKey);
  return isSourceBoundDisclosure(source) &&
    hasValidTargetId(source.ariaControls)
    ? sourceBoundIdentityFor(source.ariaControls)
    : step.controlKey;
};

export const sequenceFor = (path: RevealPath): readonly string[] =>
  path.steps.map(sequenceKeyForStep);

const sourceBoundAfterControlFor = (
  step: RevealPath["steps"][number],
  targetId: string,
): RevealSurfaceControl | undefined => {
  const matches = step.after.controls.filter(
    (control) =>
      control.ariaControls === targetId &&
      control.disclosureIndependence === SOURCE_BOUND_ROW_LOCAL,
  );
  return matches.length === 1 ? matches[0] : undefined;
};

const toggleBindingForStep = (
  step: RevealPath["steps"][number],
): ToggleBinding | undefined => {
  if (
    step.operation !== "click" ||
    step.safety !== "read-only" ||
    !SCOPED_DISCLOSURE_TRANSITIONS.has(step.transition) ||
    step.beforeUrl !== step.afterUrl ||
    hasModalOrBackgroundControl(step.before)
  )
    return undefined;

  const source = sourceControlFor(step.before, step.controlKey);
  if (!isSourceBoundDisclosure(source)) return undefined;
  const targetId = source.ariaControls;
  if (!hasValidTargetId(targetId) || typeof source.ariaExpanded !== "boolean")
    return undefined;
  const beforeMatches = step.before.controls.filter(
    (control) =>
      isSourceBoundDisclosure(control) && control.ariaControls === targetId,
  );
  if (beforeMatches.length !== 1 || beforeMatches[0] !== source)
    return undefined;
  const after = sourceBoundAfterControlFor(step, targetId);
  if (
    after === undefined ||
    typeof after.ariaExpanded !== "boolean" ||
    after.ariaExpanded === source.ariaExpanded
  )
    return undefined;

  return { identity: sourceBoundIdentityFor(targetId), targetId };
};

export const toggleBindingsFor = (
  path: RevealPath,
): readonly ToggleBinding[] | undefined => {
  const bindings = path.steps.map(toggleBindingForStep);
  return bindings.every(isDefined) ? bindings : undefined;
};

export const uniqueBindingsFor = (
  bindings: readonly ToggleBinding[],
): boolean =>
  new Set(bindings.map(({ identity }) => identity)).size === bindings.length &&
  new Set(bindings.map(({ targetId }) => targetId)).size === bindings.length;

export const knownBranchesFor = (
  state: RevealDiscoveryState,
): readonly BranchView[] => {
  const views: BranchView[] = [...state.queue];
  if (state.currentBranch !== undefined) views.push(state.currentBranch);
  const fromControls = new Map<string, BranchView>();
  for (const control of state.controls) {
    const path = control.revealPath;
    const url = path.steps.at(-1)?.afterUrl ?? path.initialUrl;
    if (!fromControls.has(path.digest))
      fromControls.set(path.digest, {
        path,
        surface: control.expectedSurface,
        url,
      });
  }
  return [...views, ...fromControls.values()];
};
