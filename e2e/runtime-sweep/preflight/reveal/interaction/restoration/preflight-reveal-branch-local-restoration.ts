import type { Action } from "../../../../source/contracts.ts";
import { stableSerialize } from "../../../../support/ids.ts";
import { revealSurfaceFor } from "../../../reveal-path.ts";
import {
  isSourceBoundDisclosureControl,
  toggleBindingsAnalysisFor,
} from "../../guards/preflight-reveal-canonicalization.ts";
import {
  assertNonMutation,
  assertRoutePath,
} from "../../guards/preflight-reveal-guards.ts";
import {
  liveRevealActionBoundary,
  liveRevealExecutionUrl,
} from "../preflight-reveal-action-boundary.ts";
import type { RevealExecutionContext } from "../preflight-reveal-branch-execution-types.ts";
import type {
  RevealBranch,
  RevealCandidate,
  RevealCandidateTerminalResult,
} from "../preflight-reveal-branches.ts";
import { RevealDiscoveryError } from "../preflight-reveal-types.ts";

const singleStepBindingTargetFor = (
  branch: RevealBranch,
): string | undefined => {
  const step = branch.path.steps.at(-1);
  if (step === undefined) return undefined;
  const analysis = toggleBindingsAnalysisFor({
    digest: branch.path.digest,
    initialUrl: step.beforeUrl,
    steps: [step],
  });
  return analysis.eligible ? analysis.bindings[0]?.targetId : undefined;
};

const candidateTargetFor = (
  branch: RevealBranch,
  candidate: RevealCandidate,
): string | undefined => {
  if (
    candidate.action.operation !== "click" ||
    candidate.action.safety !== "read-only" ||
    candidate.control.role !== "button" ||
    !candidate.control.enabled ||
    candidate.control.disclosureIndependence !== "source-bound-row-local" ||
    typeof candidate.control.ariaControls !== "string" ||
    candidate.control.ariaControls.length === 0 ||
    typeof candidate.control.ariaExpanded !== "boolean"
  )
    return undefined;
  const matches = branch.surface.controls.filter(
    ({ controlKey }) => controlKey === candidate.control.controlKey,
  );
  const control = matches.length === 1 ? matches[0] : undefined;
  if (
    !isSourceBoundDisclosureControl(control) ||
    typeof control.ariaControls !== "string" ||
    control.ariaControls.length === 0 ||
    typeof control.ariaExpanded !== "boolean" ||
    control.ariaControls !== candidate.control.ariaControls ||
    control.ariaExpanded !== candidate.control.ariaExpanded
  )
    return undefined;
  return control.ariaControls;
};

export const canReuseRevealBranchForCandidate = (
  branch: RevealBranch,
  candidate: RevealCandidate,
): boolean => {
  const sourceTarget = singleStepBindingTargetFor(branch);
  const candidateTarget = candidateTargetFor(branch, candidate);
  return (
    sourceTarget !== undefined &&
    candidateTarget !== undefined &&
    sourceTarget !== candidateTarget
  );
};

export const branchLocalInverseActionBudgetFor = (input: {
  readonly depth: number;
  readonly candidateCount: number;
}): Readonly<{ readonly physical: number; readonly charged: number }> => {
  if (
    !Number.isSafeInteger(input.depth) ||
    input.depth < 1 ||
    !Number.isSafeInteger(input.candidateCount) ||
    input.candidateCount < 1
  )
    throw new RevealDiscoveryError(
      "Branch-local inverse budget requires positive integers",
    );
  const physical = input.depth + 2 * input.candidateCount - 1;
  const charged = input.candidateCount * (input.depth + 1);
  if (physical > charged)
    throw new RevealDiscoveryError(
      "Branch-local inverse actions exceed the logical reveal debit",
    );
  return { physical, charged };
};

const restoredBranchForExecution = async (input: {
  readonly context: RevealExecutionContext;
  readonly source: RevealBranch;
  readonly terminalBranch: RevealBranch;
  readonly execution: Awaited<
    ReturnType<RevealExecutionContext["harness"]["executeReveal"]>
  >;
  readonly rawUrl: string;
}): Promise<RevealBranch> => {
  const initialExecutionUrl = liveRevealExecutionUrl(
    input.context.harness,
    input.execution.url,
    input.rawUrl,
  );
  assertRoutePath(input.context.route, initialExecutionUrl);
  assertNonMutation(input.execution);
  const immediateSurface = revealSurfaceFor(input.execution.inventory.controls);
  const inventory =
    input.context.harness.waitForRevealSurfaceReady === undefined ||
    stableSerialize(immediateSurface) === stableSerialize(input.source.surface)
      ? input.execution.inventory
      : await input.context.harness
          .waitForRevealSurfaceReady(input.source.surface, immediateSurface)
          .then(async () => input.context.harness.inventory());
  const surface = revealSurfaceFor(inventory.controls);
  const settledExecutionUrl = liveRevealExecutionUrl(
    input.context.harness,
    input.execution.url,
    input.rawUrl,
  );
  if (
    settledExecutionUrl !== input.source.url ||
    stableSerialize(surface) !== stableSerialize(input.source.surface) ||
    stableSerialize(inventory) !== stableSerialize(input.source.inventory)
  )
    throw new RevealDiscoveryError(
      "Branch-local inverse did not restore the exact source branch",
    );
  return {
    ...input.source,
    inventory,
    surface,
    url: settledExecutionUrl,
    preparation: input.terminalBranch.preparation,
  };
};

export const inverseRestorationBindingFor = (input: {
  readonly source: RevealBranch;
  readonly candidate: RevealCandidate;
  readonly terminalBranch: RevealBranch;
}): Readonly<{ readonly action: Action; readonly target: string }> => {
  const target = candidateTargetFor(input.source, input.candidate);
  const terminalTarget = singleStepBindingTargetFor(input.terminalBranch);
  if (target === undefined || terminalTarget !== target)
    throw new RevealDiscoveryError(
      "Branch-local inverse terminal binding drifted",
    );
  const matches = input.terminalBranch.surface.controls.filter(
    (control) =>
      isSourceBoundDisclosureControl(control) &&
      control.ariaControls === target,
  );
  const control = matches.length === 1 ? matches[0] : undefined;
  if (control === undefined || typeof control.ariaExpanded !== "boolean")
    throw new RevealDiscoveryError(
      "Branch-local inverse target is missing or ambiguous",
    );
  return {
    target,
    action: {
      controlKey: control.controlKey,
      operation: "click",
      safety: "read-only",
      transition: control.ariaExpanded ? "cancel" : "open",
    },
  };
};

export const restoreRevealBranchLocally = async (input: {
  readonly context: RevealExecutionContext;
  readonly source: RevealBranch;
  readonly terminal: RevealCandidateTerminalResult;
}): Promise<
  | import("../evidence/preflight-reveal-operation-recorder.ts").VerifiedBranchRestorationLease
  | undefined
> => {
  if (
    input.context.operationRecorder === undefined ||
    !canReuseRevealBranchForCandidate(input.source, input.terminal.candidate)
  )
    return undefined;
  const terminalBranch = input.terminal.result.branch;
  const inverse = inverseRestorationBindingFor({
    source: input.source,
    candidate: input.terminal.candidate,
    terminalBranch,
  });
  const boundary = await liveRevealActionBoundary(
    input.context.harness,
    terminalBranch,
    inverse.action,
  );
  const execution = await input.context.harness.executeReveal({
    executionKind: "replay",
    control: boundary.control,
    action: inverse.action,
    preparation: terminalBranch.preparation,
  });
  const restored = await restoredBranchForExecution({
    context: input.context,
    source: input.source,
    terminalBranch,
    execution,
    rawUrl: boundary.rawUrl,
  });
  return input.context.operationRecorder.createRestorationLease({
    source: input.source,
    terminal: terminalBranch,
    restored,
    candidate: input.terminal.candidate,
    inverseAction: inverse.action,
    ariaControlsTarget: inverse.target,
    nonMutation: execution.nonMutation,
  });
};
