import { performance } from "node:perf_hooks";

import { REVEAL_CONTINUATION_ATTEMPT_MAX_MS } from "../../reveal/continuation/contracts/preflight-reveal-continuation-limits.ts";

export type RunHostCheckpointController = (input: {
  readonly signal: AbortSignal;
}) => Promise<number>;

type ControllerOutcome =
  Readonly<{ readonly code: number }> | Readonly<{ readonly error: unknown }>;

export type RevealCanaryLifecycle = Readonly<{
  signal: AbortSignal;
  deadlineAt: number;
  deadlineMonotonic: number;
  monotonicNow: () => number;
  controller: Promise<ControllerOutcome>;
  abort: (reason: unknown) => void;
  close: () => void;
}>;

const abortReasonFor = (signal: NodeJS.Signals): Error =>
  new Error(`Reveal canary interrupted by ${signal}`);

export const createRevealCanaryLifecycle = (
  runController: RunHostCheckpointController,
): RevealCanaryLifecycle => {
  const owner = new AbortController();
  const onInterrupt = (): void => owner.abort(abortReasonFor("SIGINT"));
  const onTerminate = (): void => owner.abort(abortReasonFor("SIGTERM"));
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);
  const deadline = setTimeout(
    () =>
      owner.abort(new Error("Reveal continuation 24-minute deadline exceeded")),
    REVEAL_CONTINUATION_ATTEMPT_MAX_MS,
  );
  const controller = runController({ signal: owner.signal }).then(
    (code) => ({ code }) as const,
    (error: unknown) => {
      owner.abort(error);
      return { error } as const;
    },
  );
  return {
    signal: owner.signal,
    deadlineAt: Date.now() + REVEAL_CONTINUATION_ATTEMPT_MAX_MS,
    deadlineMonotonic: performance.now() + REVEAL_CONTINUATION_ATTEMPT_MAX_MS,
    monotonicNow: performance.now.bind(performance),
    controller,
    abort: (reason) => owner.abort(reason),
    close: () => {
      clearTimeout(deadline);
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onTerminate);
    },
  };
};

export const settleControllerAfterParentExit = async (
  lifecycle: RevealCanaryLifecycle,
  exitCode: number,
): Promise<void> => {
  const parentFailure =
    exitCode === 0
      ? undefined
      : new Error(`Reveal continuation exited with code ${String(exitCode)}`);
  if (parentFailure !== undefined) lifecycle.abort(parentFailure);
  const outcome = await lifecycle.controller;
  if ("error" in outcome) {
    if (parentFailure === undefined) throw outcome.error;
    if (outcome.error === parentFailure) return;
    throw new AggregateError(
      [parentFailure, outcome.error],
      "Reveal continuation and controller cleanup both failed",
    );
  }
  if (outcome.code === 0) return;
  const controllerFailure = new Error(
    `Host checkpoint controller exited with code ${String(outcome.code)}`,
  );
  if (parentFailure === undefined) throw controllerFailure;
  throw new AggregateError(
    [parentFailure, controllerFailure],
    "Reveal continuation and controller cleanup both failed",
  );
};

export const settleControllerAfterParentFailure = async (
  lifecycle: RevealCanaryLifecycle,
  primary: unknown,
): Promise<never> => {
  lifecycle.abort(primary);
  const outcome = await lifecycle.controller;
  if ("error" in outcome) {
    if (outcome.error === primary) throw primary;
    throw new AggregateError(
      [primary, outcome.error],
      "Reveal canary and host-checkpoint controller both failed",
    );
  }
  if (outcome.code === 0) throw primary;
  throw new AggregateError(
    [
      primary,
      new Error(
        `Host checkpoint controller exited with code ${String(outcome.code)}`,
      ),
    ],
    "Reveal canary and host-checkpoint controller both failed",
  );
};
