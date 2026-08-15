import { candidatesForImmediateReveal } from "../guards/preflight-reveal-registration.ts";
import { sameRevealSurfaceMaterial } from "../guards/reveal-surface-material.ts";
import {
  branchFor,
  restoreRevealBranch,
} from "./preflight-reveal-branch-execution.ts";
import {
  controlsWithTransition,
  enqueueChangedBranch,
  type RevealBranch,
  type RevealCandidate,
  revealCandidateAlreadyProcessed,
  type RevealCandidateTerminalResult,
  type RevealDiscoveryState,
  type RevealPureQueueInput,
  type RevealQueueChunkResult,
  type RevealQueueInput,
} from "./preflight-reveal-branches.ts";
import {
  processCandidates,
  type RevealQueueYieldHandler,
} from "./preflight-reveal-queue-candidates.ts";
import { RevealDiscoveryError } from "./preflight-reveal-types.ts";

const freezeCandidateInput = async (
  input: RevealQueueInput,
  candidate: RevealCandidate,
): Promise<RevealCandidate> => {
  const operation = candidate.action.operation;
  if (operation !== "fill" && operation !== "select") return candidate;
  if (candidate.representativeInput !== undefined) return candidate;
  if (operation === "fill")
    throw new RevealDiscoveryError(
      `Fill reveal lacks a frozen representative input: ${candidate.action.controlKey}`,
    );
  const freeze = input.harness.freezeRepresentativeInput;
  if (freeze === undefined)
    throw new RevealDiscoveryError(
      `Select reveal cannot freeze a representative input: ${candidate.action.controlKey}`,
    );
  const representativeInput = await freeze({
    control: candidate.control,
    action: candidate.action,
  });
  if (representativeInput?.kind !== "select")
    throw new RevealDiscoveryError(
      `Select reveal lacks a frozen representative input: ${candidate.action.controlKey}`,
    );
  return { ...candidate, representativeInput };
};

export const freezeRevealCandidateInputs = (
  input: RevealQueueInput,
  candidates: readonly RevealCandidate[],
): Promise<readonly RevealCandidate[]> =>
  Promise.all(
    candidates.map((candidate) => freezeCandidateInput(input, candidate)),
  );

const processRevealCandidate = async (input: {
  readonly queueInput: RevealQueueInput;
  readonly current: RevealBranch;
  readonly state: RevealDiscoveryState;
  readonly candidate: RevealCandidate;
  readonly restoredBranch?: RevealBranch;
}): Promise<
  Readonly<{
    readonly state: RevealDiscoveryState;
    readonly executed: boolean;
    readonly terminal?: RevealCandidateTerminalResult;
  }>
> => {
  const { queueInput, current, state, candidate } = input;
  if (revealCandidateAlreadyProcessed(state, current, candidate))
    return { state, executed: false };
  if (
    state.actionCount + current.path.steps.length + 1 >
    queueInput.maxRevealActions
  )
    throw new RevealDiscoveryError("Reveal action bound exceeded");
  const result = await branchFor({
    harness: queueInput.harness,
    state: queueInput.state,
    route: queueInput.route,
    initialSurface: queueInput.initialSurface,
    branch: current,
    candidate,
    ...(input.restoredBranch === undefined
      ? {}
      : { restoredBranch: input.restoredBranch }),
  });
  const materialChanged =
    result.explore &&
    !(
      sameRevealSurfaceMaterial(current.surface, result.branch.surface) &&
      current.url === result.branch.url
    );
  const terminal: RevealCandidateTerminalResult = {
    candidate,
    result,
    candidateIndex: state.currentCandidateIndex ?? 0,
    materialChanged,
  };
  return {
    state: applyRevealCandidateResult({
      input: queueInput,
      state,
      current,
      terminal,
    }),
    executed: true,
    terminal,
  };
};

/**
 * Applies one terminal candidate without browser work. Live execution and
 * receipt replay share this registration and bound-accounting path.
 */
export const applyRevealCandidateResult = (input: {
  readonly input: RevealPureQueueInput;
  readonly state: RevealDiscoveryState;
  readonly current: RevealBranch;
  readonly terminal: RevealCandidateTerminalResult;
}): RevealDiscoveryState => {
  const { input: queueInput, state, current, terminal } = input;
  const actionCount = state.actionCount + current.path.steps.length + 1;
  if (actionCount > queueInput.maxRevealActions)
    throw new RevealDiscoveryError("Reveal action bound exceeded");
  const branchCount = state.branchCount + (terminal.materialChanged ? 1 : 0);
  if (
    terminal.materialChanged &&
    branchCount > queueInput.maxRevealMaterialEdges
  )
    throw new RevealDiscoveryError("Reveal material edge bound exceeded");
  const transitioned: RevealDiscoveryState = {
    ...state,
    controls: controlsWithTransition(
      state.controls,
      current,
      terminal.candidate.action,
      terminal.result.transition,
      terminal.result.branch.surface,
    ),
    actionCount,
    branchCount,
  };
  if (!terminal.materialChanged) return transitioned;
  return enqueueChangedBranch({
    queueInput,
    state: transitioned,
    current,
    branch: terminal.result.branch,
  });
};

export const processRevealQueueChunk = async (
  input: RevealQueueInput,
  state: RevealDiscoveryState,
  shouldYieldAfterCandidate?: RevealQueueYieldHandler,
): Promise<RevealQueueChunkResult> => {
  const current = state.currentBranch ?? state.queue[0];
  if (current === undefined)
    return { state: { ...state, queue: [] }, completed: true };
  const remaining = state.currentBranch ? state.queue : state.queue.slice(1);
  const unfrozenCandidates =
    state.currentCandidates ?? candidatesForImmediateReveal(input, current);
  const requiresLiveRestore = unfrozenCandidates.some(
    (candidate) =>
      candidate.action.operation === "select" &&
      candidate.representativeInput === undefined,
  );
  const restoredBranch = requiresLiveRestore
    ? await restoreRevealBranch({
        harness: input.harness,
        state: input.state,
        route: input.route,
        initialSurface: input.initialSurface,
        branch: current,
      })
    : undefined;
  const candidates = await freezeRevealCandidateInputs(
    input,
    unfrozenCandidates,
  );
  return processCandidates(
    {
      queueInput: input,
      state: {
        ...state,
        queue: remaining,
        currentBranch: current,
        currentCandidates: candidates,
        currentCandidateIndex: state.currentCandidateIndex ?? 0,
      },
      current,
      candidates,
      index: state.currentCandidateIndex ?? 0,
      ...(restoredBranch === undefined ? {} : { restoredBranch }),
      ...(shouldYieldAfterCandidate === undefined
        ? {}
        : { shouldYieldAfterCandidate }),
    },
    processRevealCandidate,
    processRevealQueueChunk,
  );
};

export const processRevealQueue = async (
  input: RevealQueueInput,
  state: RevealDiscoveryState,
): Promise<RevealDiscoveryState> => {
  const result = await processRevealQueueChunk(input, state);
  if (!result.completed)
    throw new RevealDiscoveryError(
      "Reveal queue unexpectedly yielded without a continuation budget",
    );
  return result.state;
};
