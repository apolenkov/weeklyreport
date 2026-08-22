import { setTimeout as delay } from "node:timers/promises";

import { spawnPreflightDiagnosticPlaywrightChild } from "../launch/preflight-diagnostic-playwright-child.ts";
import {
  type ChildGroupTerminationInput,
  terminateOwnedChildGroup,
  type WaitForMilliseconds,
} from "./preflight-diagnostic-child-termination.ts";
import {
  type ControlledDiagnosticState,
  createControlledDiagnosticState,
} from "./preflight-diagnostic-controlled-state.ts";
import {
  type DiagnosticHostEnvelopeCounters,
  type DiagnosticHostEnvelopeSnapshot,
  HOST_ENVELOPE_THRESHOLDS,
  readDarwinHostEnvelopeSnapshot,
} from "./preflight-diagnostic-host-envelope.ts";
import { evaluateHostEnvelopeSample } from "./preflight-diagnostic-host-envelope-evaluator.ts";
import {
  createDiagnosticHostEnvelopeReceipt,
  type DiagnosticHostEnvelopeReceipt,
} from "./preflight-diagnostic-host-envelope-receipt.ts";

export { terminateOwnedChildGroup } from "./preflight-diagnostic-child-termination.ts";

export type ControlledDiagnosticChild = Readonly<{
  readonly pid: number | undefined;
  readonly completion: Promise<number>;
}>;

type BaselineResult = Readonly<{
  readonly lastSnapshot: DiagnosticHostEnvelopeSnapshot;
  readonly counters: DiagnosticHostEnvelopeCounters;
}>;

type BaselineCollector = (input: {
  readonly phase: "post-infrastructure";
  readonly sampleCount: number;
  readonly receipt: DiagnosticHostEnvelopeReceipt;
}) => Promise<BaselineResult>;

export type ControlledDiagnosticInput = Readonly<{
  readonly repoRoot: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly archiveRoot: string;
  readonly outputRoot: string;
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly campaignId: string;
  readonly collectBaseline: BaselineCollector;
  readonly createReceipt?: typeof createDiagnosticHostEnvelopeReceipt;
  readonly spawnChild?: (input: {
    readonly repoRoot: string;
    readonly environment: NodeJS.ProcessEnv;
    readonly detached: true;
  }) => ControlledDiagnosticChild;
  readonly readSnapshot?: typeof readDarwinHostEnvelopeSnapshot;
  readonly wait?: WaitForMilliseconds;
  readonly terminateChildGroup?: (
    input: ChildGroupTerminationInput,
  ) => Promise<void>;
}>;

const errorFor = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const childFailureFor = (state: ControlledDiagnosticState): Error | undefined =>
  state.childError ??
  (state.childExitCode !== undefined &&
  state.childExitCode !== 0 &&
  !state.terminationRequested
    ? new Error(
        `Diagnostic Playwright child exited with code ${state.childExitCode}`,
      )
    : undefined);

const primaryFailureFor = (
  state: ControlledDiagnosticState,
  childFailure: Error | undefined,
): Error | undefined =>
  state.monitorFailureBeforeChild
    ? (state.monitorError ?? childFailure)
    : (childFailure ?? state.monitorError);

const finalStatusFor = (input: {
  readonly state: ControlledDiagnosticState;
  readonly primaryFailure: Error | undefined;
}): "healthy" | "breach" | "invalid" | "inconclusive" => {
  if (
    input.state.monitorError !== undefined &&
    input.state.terminationRequested &&
    (input.state.monitorFailureBeforeChild ||
      input.primaryFailure === undefined)
  )
    return input.state.monitorStatus;
  if (input.primaryFailure === undefined && input.state.childExitCode === 0)
    return "healthy";
  return "inconclusive";
};

const finishControlledDiagnostic = async (input: {
  readonly state: ControlledDiagnosticState;
  readonly receipt: DiagnosticHostEnvelopeReceipt;
}): Promise<void> => {
  const { state, receipt } = input;
  state.monitorStopped = true;
  try {
    await state.monitorTask;
  } catch (error: unknown) {
    state.monitorError ??= errorFor(error);
  }
  const childFailure = childFailureFor(state);
  const primaryFailure = primaryFailureFor(state, childFailure);
  const finalStatus = finalStatusFor({ state, primaryFailure });
  const reason =
    primaryFailure?.message ??
    (state.childExitCode === undefined
      ? "diagnostic child did not produce an exit code"
      : `child exit ${state.childExitCode}`);
  try {
    await receipt.finalize({ status: finalStatus, reason });
  } catch (error: unknown) {
    state.receiptError = errorFor(error);
  }
  if (primaryFailure !== undefined) throw primaryFailure;
  if (state.receiptError !== undefined) throw state.receiptError;
};

const monitorChild = async (input: {
  readonly child: ControlledDiagnosticChild;
  readonly baseline: BaselineResult;
  readonly receipt: DiagnosticHostEnvelopeReceipt;
  readonly state: ControlledDiagnosticState;
  readonly requestTermination: (pid: number | undefined) => Promise<void>;
  readonly readSnapshot: typeof readDarwinHostEnvelopeSnapshot;
  readonly wait: WaitForMilliseconds;
}): Promise<void> => {
  for (;;) {
    await input.wait(HOST_ENVELOPE_THRESHOLDS.sampleIntervalMs);
    if (input.state.monitorStopped) return;
    const snapshot = await input.readSnapshot("runtime");
    const evaluation = evaluateHostEnvelopeSample({
      snapshot,
      baselineSwapUsedBytes: input.baseline.lastSnapshot.swapUsedBytes ?? 0,
      priorCounters: input.state.previousCounters,
      breachStreaks: input.state.breachStreaks,
    });
    await input.receipt.record({
      snapshot,
      status: evaluation.status,
      reasons: evaluation.reasons,
      breachStreaks: evaluation.breachStreaks,
    });
    input.state.previousCounters = evaluation.nextCounters;
    input.state.breachStreaks = evaluation.breachStreaks;
    if (evaluation.status === "invalid" || evaluation.status === "breach") {
      input.state.monitorStatus = evaluation.status;
      if (!input.state.childCompletionObserved)
        input.state.monitorFailureBeforeChild = true;
      input.state.monitorError ??= new Error(
        `Host envelope ${evaluation.status}: ${evaluation.reasons.join(", ")}`,
      );
      await input.requestTermination(input.child.pid);
      return;
    }
  }
};

const observeChildCompletion = async (input: {
  readonly child: ControlledDiagnosticChild;
  readonly state: ControlledDiagnosticState;
}): Promise<void> => {
  const completion = input.child.completion.then(
    (exitCode) => {
      input.state.childExitCode = exitCode;
    },
    (error: unknown) => {
      input.state.childError = errorFor(error);
    },
  );
  await Promise.race([completion, input.state.terminationSettled]);
  if (!input.state.childCompletionObserved) {
    input.state.childError ??= new Error(
      "Diagnostic child completion was not observed after bounded termination",
    );
  }
  input.state.childCompletionObserved = true;
};

const requestTerminationFor = (input: {
  readonly state: ControlledDiagnosticState;
  readonly child: ControlledDiagnosticChild;
  readonly terminate: (input: ChildGroupTerminationInput) => Promise<void>;
  readonly rememberMonitorError: (error: unknown) => void;
}): Promise<void> => {
  if (input.state.terminationTask !== undefined)
    return input.state.terminationTask;
  input.state.terminationRequested = true;
  input.state.terminationTask = input
    .terminate({
      pid: input.child.pid,
      completion: input.child.completion,
    })
    .catch((error: unknown) => {
      input.rememberMonitorError(error);
    })
    .finally(() => input.state.resolveTermination());
  return input.state.terminationTask;
};

const rememberMonitorErrorFor = (
  state: ControlledDiagnosticState,
  error: unknown,
): void => {
  if (!state.childCompletionObserved) state.monitorFailureBeforeChild = true;
  state.monitorError ??= errorFor(error);
};

export const runControlledDiagnostic = async (
  input: ControlledDiagnosticInput,
): Promise<number> => {
  const receipt = await (
    input.createReceipt ?? createDiagnosticHostEnvelopeReceipt
  )({
    archiveRoot: input.archiveRoot,
    outputRoot: input.outputRoot,
    sourceSha: input.sourceSha,
    sourceTree: input.sourceTree,
    campaignId: input.campaignId,
  });
  const state = createControlledDiagnosticState();
  const rememberMonitorError = (error: unknown): void =>
    rememberMonitorErrorFor(state, error);
  try {
    const baseline = await input.collectBaseline({
      phase: "post-infrastructure",
      sampleCount: HOST_ENVELOPE_THRESHOLDS.postInfrastructureBaselineSamples,
      receipt,
    });
    const child = input.spawnChild
      ? input.spawnChild({
          repoRoot: input.repoRoot,
          environment: input.environment,
          detached: true,
        })
      : (() => {
          const launched = spawnPreflightDiagnosticPlaywrightChild({
            repoRoot: input.repoRoot,
            environment: input.environment,
            detached: true,
          });
          return {
            pid: launched.child.pid ?? undefined,
            completion: launched.completion,
          };
        })();
    const readSnapshot = input.readSnapshot ?? readDarwinHostEnvelopeSnapshot;
    const wait = input.wait ?? ((milliseconds: number) => delay(milliseconds));
    const terminate = input.terminateChildGroup ?? terminateOwnedChildGroup;
    const requestTermination = () =>
      requestTerminationFor({
        state,
        child,
        terminate,
        rememberMonitorError,
      });
    state.previousCounters = baseline.counters;
    state.monitorTask = monitorChild({
      child,
      baseline,
      receipt,
      state,
      requestTermination,
      readSnapshot,
      wait,
    }).catch((error: unknown) => {
      rememberMonitorError(error);
      return requestTermination();
    });
    await observeChildCompletion({ child, state });
  } catch (error: unknown) {
    rememberMonitorError(error);
  } finally {
    await finishControlledDiagnostic({ state, receipt });
  }
  return state.monitorError === undefined ? (state.childExitCode ?? 1) : 1;
};
