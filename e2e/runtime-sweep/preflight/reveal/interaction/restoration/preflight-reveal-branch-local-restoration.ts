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

const inverseActionFor = (input: {
  readonly source: RevealBranch;
  readonly terminal: RevealCandidateTerminalResult;
}): Action => {
  const target = candidateTargetFor(input.source, input.terminal.candidate);
  const terminalTarget = singleStepBindingTargetFor(
    input.terminal.result.branch,
  );
  if (target === undefined || terminalTarget !== target)
    throw new RevealDiscoveryError(
      "Branch-local inverse terminal binding drifted",
    );
  const matches = input.terminal.result.branch.surface.controls.filter(
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
    controlKey: control.controlKey,
    operation: "click",
    safety: "read-only",
    transition: control.ariaExpanded ? "cancel" : "open",
  };
};

export const restoreRevealBranchLocally = async (input: {
  readonly context: RevealExecutionContext;
  readonly source: RevealBranch;
  readonly terminal: RevealCandidateTerminalResult;
}): Promise<RevealBranch | undefined> => {
  if (!canReuseRevealBranchForCandidate(input.source, input.terminal.candidate))
    return undefined;
  const terminalBranch = input.terminal.result.branch;
  const action = inverseActionFor({
    source: input.source,
    terminal: input.terminal,
  });
  const boundary = await liveRevealActionBoundary(
    input.context.harness,
    terminalBranch,
    action,
  );
  const execution = await input.context.harness.executeReveal({
    executionKind: "replay",
    control: boundary.control,
    action,
    preparation: terminalBranch.preparation,
  });
  const initialExecutionUrl = liveRevealExecutionUrl(
    input.context.harness,
    execution.url,
    boundary.rawUrl,
  );
  assertRoutePath(input.context.route, initialExecutionUrl);
  assertNonMutation(execution);
  const immediateSurface = revealSurfaceFor(execution.inventory.controls);
  const inventory =
    input.context.harness.waitForRevealSurfaceReady === undefined ||
    stableSerialize(immediateSurface) === stableSerialize(input.source.surface)
      ? execution.inventory
      : await input.context.harness
          .waitForRevealSurfaceReady(input.source.surface, immediateSurface)
          .then(async () => input.context.harness.inventory());
  const surface = revealSurfaceFor(inventory.controls);
  const settledExecutionUrl = liveRevealExecutionUrl(
    input.context.harness,
    execution.url,
    boundary.rawUrl,
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
    preparation: terminalBranch.preparation,
  };
};
