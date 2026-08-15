import {
  type RevealTransition,
  revealTransitionFor,
} from "../../../matrix/reveal-transition.ts";
import type { Action } from "../../../source/contracts.ts";
import { stableSerialize } from "../../../support/ids.ts";
import {
  type RevealPath,
  revealPathFor,
  revealStepFor,
  revealSurfaceFor,
} from "../../reveal-path.ts";
import {
  assertInitialInventory,
  assertNonMutation,
  assertRoutePath,
  requiredCurrentUrl,
  sameRevealRoutePath,
} from "../guards/preflight-reveal-guards.ts";
import { sameRevealSurface } from "../guards/preflight-reveal-registration.ts";
import {
  liveRevealActionBoundary,
  liveRevealExecutionUrl,
} from "./preflight-reveal-action-boundary.ts";
import type {
  RevealBranch,
  RevealCandidate,
  RevealQueueInput,
} from "./preflight-reveal-branches.ts";
import {
  RevealDiscoveryError,
  type RevealExecutionHarness,
  type RevealRepresentativeInput,
} from "./preflight-reveal-types.ts";

export type RevealActionResult = Readonly<{
  readonly branch: RevealBranch;
  readonly transition: RevealTransition;
  readonly explore: boolean;
}>;
type RevealExecutionContext = Pick<
  RevealQueueInput,
  "harness" | "state" | "route" | "initialSurface"
>;
const assertRepresentativeInput = (
  action: Action,
  expected: RevealRepresentativeInput | undefined,
  actual: RevealRepresentativeInput | undefined,
): void => {
  const formAction =
    action.operation === "fill" || action.operation === "select";
  if (!formAction) {
    if (actual !== undefined)
      throw new RevealDiscoveryError(
        `Non-form reveal returned a representative input: ${action.controlKey}`,
      );
    return;
  }
  if (expected === undefined || actual === undefined)
    throw new RevealDiscoveryError(
      `Form reveal lacks a frozen representative input: ${action.controlKey}`,
    );
  if (stableSerialize(expected) !== stableSerialize(actual))
    throw new RevealDiscoveryError(
      `Form reveal representative input drifted: ${action.controlKey}`,
    );
};
const actionFromStep = (step: RevealPath["steps"][number]): Action => {
  const {
    before: _before,
    after: _after,
    beforeUrl: _beforeUrl,
    afterUrl: _afterUrl,
    nonMutation: _nonMutation,
    representativeInput: _representativeInput,
    ...action
  } = step;
  return action;
};
const replayStep = async (input: {
  readonly harness: RevealExecutionHarness;
  readonly route: RevealQueueInput["route"];
  readonly current: RevealBranch;
  readonly step: RevealPath["steps"][number];
}): Promise<RevealBranch> => {
  const { current, step } = input;
  if (current.url !== step.beforeUrl)
    throw new RevealDiscoveryError(
      `Reveal path before URL drifted for ${step.controlKey}`,
    );
  if (stableSerialize(current.surface) !== stableSerialize(step.before))
    throw new RevealDiscoveryError(
      `Reveal path before surface drifted for ${step.controlKey}`,
    );
  const action = actionFromStep(step);
  const boundary = await liveRevealActionBoundary(
    input.harness,
    current,
    action,
  );
  const execution = await input.harness.executeReveal({
    control: boundary.control,
    action,
    ...(step.representativeInput === undefined
      ? {}
      : { representativeInput: step.representativeInput }),
    preparation: current.preparation,
  });
  assertRepresentativeInput(
    actionFromStep(step),
    step.representativeInput,
    execution.representativeInput,
  );
  const executionUrl = liveRevealExecutionUrl(
    input.harness,
    execution.url,
    boundary.rawUrl,
  );
  assertRoutePath(input.route, executionUrl);
  assertNonMutation(execution);
  const surface = revealSurfaceFor(execution.inventory.controls);
  if (stableSerialize(surface) !== stableSerialize(step.after))
    throw new RevealDiscoveryError(
      `Reveal path after surface drifted for ${step.controlKey}`,
    );
  if (executionUrl !== step.afterUrl)
    throw new RevealDiscoveryError(
      `Reveal path after URL drifted for ${step.controlKey}`,
    );
  if (
    stableSerialize(execution.nonMutation) !== stableSerialize(step.nonMutation)
  )
    throw new RevealDiscoveryError(
      `Reveal path database proof drifted for ${step.controlKey}`,
    );
  return {
    path: current.path,
    inventory: execution.inventory,
    surface,
    url: executionUrl,
    preparation: current.preparation,
  };
};
const replayBranch = async (
  input: RevealExecutionContext & {
    readonly path: RevealPath;
  },
): Promise<RevealBranch> => {
  const prepared = await input.harness.prepare(input.state, input.route);
  const preparation = prepared ?? undefined;
  await input.harness.navigate(input.route.resolvedRoute);
  const initial = await input.harness.inventory();
  assertInitialInventory(input.initialSurface, initial);
  const initialRawUrl = input.harness.currentUrl();
  const initialUrl = requiredCurrentUrl(initialRawUrl);
  assertRoutePath(input.route, initialUrl);
  if (initialUrl !== input.path.initialUrl)
    throw new RevealDiscoveryError("Reveal path initial URL drifted");
  return input.path.steps.reduce<Promise<RevealBranch>>(
    (promise, step) =>
      promise.then((current) =>
        replayStep({
          harness: input.harness,
          route: input.route,
          current,
          step,
        }),
      ),
    Promise.resolve<RevealBranch>({
      path: input.path,
      inventory: initial,
      surface: input.initialSurface,
      url: initialUrl,
      preparation,
    }),
  );
};

export const restoreRevealBranch = async (
  input: RevealExecutionContext & { readonly branch: RevealBranch },
): Promise<RevealBranch> => {
  const restored = await replayBranch({ ...input, path: input.branch.path });
  if (
    restored.url !== input.branch.url ||
    stableSerialize(restored.surface) !==
      stableSerialize(input.branch.surface) ||
    stableSerialize(restored.inventory) !==
      stableSerialize(input.branch.inventory)
  )
    throw new RevealDiscoveryError(
      "Reveal continuation frontier restoration drifted",
    );
  return restored;
};
const executeCandidate = async (
  input: RevealExecutionContext & { readonly candidate: RevealCandidate },
  reset: RevealBranch,
) => {
  const boundary = await liveRevealActionBoundary(
    input.harness,
    reset,
    input.candidate.action,
  );
  const execution = await input.harness.executeReveal({
    control: boundary.control,
    action: input.candidate.action,
    ...(input.candidate.representativeInput === undefined
      ? {}
      : { representativeInput: input.candidate.representativeInput }),
    preparation: reset.preparation,
  });
  assertRepresentativeInput(
    input.candidate.action,
    input.candidate.representativeInput,
    execution.representativeInput,
  );
  const executionUrl = liveRevealExecutionUrl(
    input.harness,
    execution.url,
    boundary.rawUrl,
  );
  assertNonMutation(execution);
  const surface = revealSurfaceFor(execution.inventory.controls);
  return {
    execution,
    executionUrl,
    surface,
    transition: revealTransitionFor(
      input.candidate.action,
      reset.surface,
      surface,
      reset.url,
      executionUrl,
      execution.nonMutation,
      execution.representativeInput ?? null,
    ),
  };
};

export const branchFor = async (
  input: RevealExecutionContext & {
    readonly branch: RevealBranch;
    readonly candidate: RevealCandidate;
  },
): Promise<RevealActionResult> => {
  const reset = await replayBranch({ ...input, path: input.branch.path });
  const { execution, executionUrl, surface, transition } =
    await executeCandidate(input, reset);
  const explore = sameRevealRoutePath(input.route, executionUrl);
  if (!explore)
    return {
      branch: {
        ...reset,
        inventory: execution.inventory,
        surface,
        url: executionUrl,
      },
      transition,
      explore,
    };
  if (sameRevealSurface(reset.surface, surface) && reset.url === executionUrl)
    return {
      branch: {
        ...reset,
        inventory: execution.inventory,
        surface,
        url: executionUrl,
      },
      transition,
      explore,
    };
  const step = revealStepFor(
    input.candidate.action,
    reset.surface,
    surface,
    reset.url,
    executionUrl,
    execution.nonMutation,
    execution.representativeInput,
  );
  const branch: RevealBranch = {
    path: revealPathFor(
      [...input.branch.path.steps, step],
      input.branch.path.initialUrl,
    ),
    inventory: execution.inventory,
    surface,
    url: executionUrl,
    preparation: reset.preparation,
  };
  return { branch, transition, explore };
};
