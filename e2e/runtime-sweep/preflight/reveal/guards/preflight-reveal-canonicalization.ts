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

export type ToggleBindingEligibilityPredicate =
  | "operation-not-click"
  | "safety-not-read-only"
  | "transition-not-scoped"
  | "url-changed"
  | "modal-or-background-control"
  | "source-control-not-source-bound"
  | "target-id-invalid"
  | "source-expanded-state-invalid"
  | "before-target-not-unique"
  | "after-target-not-unique"
  | "after-expanded-state-invalid-or-unchanged";

type ToggleBindingAnalysis = Readonly<
  | { readonly kind: "eligible"; readonly binding: ToggleBinding }
  | {
      readonly kind: "ineligible";
      readonly predicate: ToggleBindingEligibilityPredicate;
    }
>;

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

const hasDisclosureShape = (control: RevealSurfaceControl): boolean =>
  typeof control.ariaControls === "string" ||
  typeof control.ariaExpanded === "boolean";

export const untrustedDisclosureFor = (
  surface: RevealSurface,
): RevealSurfaceControl | undefined =>
  surface.controls.find(
    (control) =>
      hasDisclosureShape(control) &&
      control.disclosureIndependence !== SOURCE_BOUND_ROW_LOCAL,
  );

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

const basicEligibilityPredicateFor = (
  step: RevealPath["steps"][number],
): ToggleBindingEligibilityPredicate | undefined => {
  if (step.operation !== "click") return "operation-not-click";
  if (step.safety !== "read-only") return "safety-not-read-only";
  if (!SCOPED_DISCLOSURE_TRANSITIONS.has(step.transition))
    return "transition-not-scoped";
  if (step.beforeUrl !== step.afterUrl) return "url-changed";
  if (hasModalOrBackgroundControl(step.before))
    return "modal-or-background-control";
  return undefined;
};

const toggleBindingAnalysisForStep = (
  step: RevealPath["steps"][number],
): ToggleBindingAnalysis => {
  const basicPredicate = basicEligibilityPredicateFor(step);
  if (basicPredicate !== undefined)
    return {
      kind: "ineligible",
      predicate: basicPredicate,
    };

  const source = sourceControlFor(step.before, step.controlKey);
  if (!isSourceBoundDisclosure(source))
    return {
      kind: "ineligible",
      predicate: "source-control-not-source-bound",
    };
  const targetId = source.ariaControls;
  if (!hasValidTargetId(targetId))
    return { kind: "ineligible", predicate: "target-id-invalid" };
  if (typeof source.ariaExpanded !== "boolean")
    return {
      kind: "ineligible",
      predicate: "source-expanded-state-invalid",
    };
  const beforeMatches = step.before.controls.filter(
    (control) =>
      isSourceBoundDisclosure(control) && control.ariaControls === targetId,
  );
  if (beforeMatches.length !== 1 || beforeMatches[0] !== source)
    return { kind: "ineligible", predicate: "before-target-not-unique" };
  const after = sourceBoundAfterControlFor(step, targetId);
  if (after === undefined)
    return { kind: "ineligible", predicate: "after-target-not-unique" };
  if (
    typeof after.ariaExpanded !== "boolean" ||
    after.ariaExpanded === source.ariaExpanded
  )
    return {
      kind: "ineligible",
      predicate: "after-expanded-state-invalid-or-unchanged",
    };

  return {
    kind: "eligible",
    binding: { identity: sourceBoundIdentityFor(targetId), targetId },
  };
};

export type ToggleBindingsAnalysis = Readonly<
  | { readonly eligible: true; readonly bindings: readonly ToggleBinding[] }
  | {
      readonly eligible: false;
      readonly stepIndex: number;
      readonly predicate: ToggleBindingEligibilityPredicate;
    }
>;

export const toggleBindingsAnalysisFor = (
  path: RevealPath,
): ToggleBindingsAnalysis => {
  const bindings: ToggleBinding[] = [];
  for (const [stepIndex, step] of path.steps.entries()) {
    const analysis = toggleBindingAnalysisForStep(step);
    if (analysis.kind === "ineligible")
      return {
        eligible: false,
        stepIndex,
        predicate: analysis.predicate,
      };
    bindings.push(analysis.binding);
  }
  return { eligible: true, bindings };
};

export const toggleBindingsFor = (
  path: RevealPath,
): readonly ToggleBinding[] | undefined => {
  const analysis = toggleBindingsAnalysisFor(path);
  return analysis.eligible ? analysis.bindings : undefined;
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
