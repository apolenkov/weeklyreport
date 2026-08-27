import { type ChildProcess } from "node:child_process";

import {
  type ObservePreflightPlaywrightChildCleanup,
  preflightPlaywrightChildCleanupEvidenceFor,
} from "../preflight-playwright-child-cleanup.ts";
import { boundedPlaywrightArgs } from "./preflight-bounded-playwright-command.ts";
import { spawnDetachedProcessGroup } from "./preflight-detached-process-group.ts";

type BoundedPlaywrightChildInput = Readonly<{
  operationName: string;
  configPath: string;
  repoRoot: string;
  environment: NodeJS.ProcessEnv;
  maxDurationMs: number;
  terminationGraceMs: number;
  acceptNonzeroExit?: boolean;
  signal?: AbortSignal;
  onCleanup?: ObservePreflightPlaywrightChildCleanup;
}>;

type BoundedWaitInput = Pick<
  BoundedPlaywrightChildInput,
  "operationName" | "maxDurationMs" | "terminationGraceMs" | "acceptNonzeroExit"
>;

interface BoundedWaitState {
  timedOut: boolean;
  settled: boolean;
  deadline: NodeJS.Timeout | undefined;
  escalation: NodeJS.Timeout | undefined;
  terminationErrors: unknown[];
  terminationReason: unknown;
}

class PreflightBoundedPlaywrightChildError extends Error {
  override readonly name = "PreflightBoundedPlaywrightChildError";
}

const launcherFor = (
  operationName: string,
  environment: NodeJS.ProcessEnv,
): Readonly<{ command: string; leadingArgs: readonly string[] }> => {
  const executable = environment.npm_execpath?.trim();
  if (!executable)
    throw new PreflightBoundedPlaywrightChildError(
      `${operationName} launcher requires npm_execpath`,
    );
  return /\.[cm]?js$/u.test(executable)
    ? { command: process.execPath, leadingArgs: [executable] }
    : { command: executable, leadingArgs: [] };
};

const assertBoundedPlaywrightDuration = (
  operationName: string,
  name: string,
  value: number,
): void => {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new PreflightBoundedPlaywrightChildError(
      `${operationName} ${name} must be a positive safe integer`,
    );
};

const signalOrRecord = (
  signalOwned: (signal: NodeJS.Signals) => void,
  signal: NodeJS.Signals,
  failures: unknown[],
): void => {
  try {
    signalOwned(signal);
  } catch (error: unknown) {
    failures.push(error);
  }
};

const terminationFailureFor = (
  input: BoundedWaitInput,
  reason: unknown,
  terminationErrors: readonly unknown[],
): unknown => {
  const primary =
    reason ??
    new PreflightBoundedPlaywrightChildError(
      `${input.operationName} was terminated`,
    );
  return terminationErrors.length === 0
    ? primary
    : new AggregateError(
        [primary, ...terminationErrors],
        `${input.operationName} process-group termination failed`,
      );
};

const beginBoundedChildTermination = (input: {
  readonly state: BoundedWaitState;
  readonly signalOwned: (signal: NodeJS.Signals) => void;
  readonly wait: BoundedWaitInput;
  readonly reason: unknown;
  readonly reject: (error: unknown) => void;
}): void => {
  if (input.state.timedOut || input.state.settled) return;
  input.state.timedOut = true;
  input.state.terminationReason = input.reason;
  signalOrRecord(input.signalOwned, "SIGINT", input.state.terminationErrors);
  input.state.escalation = setTimeout(() => {
    signalOrRecord(input.signalOwned, "SIGKILL", input.state.terminationErrors);
    input.reject(
      terminationFailureFor(
        input.wait,
        input.state.terminationReason,
        input.state.terminationErrors,
      ),
    );
  }, input.wait.terminationGraceMs);
};

const failureForChildExit = (input: {
  readonly state: BoundedWaitState;
  readonly wait: BoundedWaitInput;
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
}): unknown => {
  if (input.state.timedOut)
    return terminationFailureFor(
      input.wait,
      input.state.terminationReason,
      input.state.terminationErrors,
    );
  if (input.code !== 0 && input.wait.acceptNonzeroExit !== true)
    return new PreflightBoundedPlaywrightChildError(
      `${input.wait.operationName} child exited code=${String(input.code)} signal=${String(input.signal)}`,
    );
  return undefined;
};

const initialBoundedWaitState = (): BoundedWaitState => ({
  timedOut: false,
  settled: false,
  deadline: undefined,
  escalation: undefined,
  terminationErrors: [],
  terminationReason: undefined,
});

const armBoundedChildDeadline = (input: {
  readonly state: BoundedWaitState;
  readonly signalOwned: (signal: NodeJS.Signals) => void;
  readonly wait: BoundedWaitInput;
  readonly reject: (error: unknown) => void;
}): NodeJS.Timeout =>
  setTimeout(
    () =>
      beginBoundedChildTermination({
        ...input,
        reason: new PreflightBoundedPlaywrightChildError(
          `${input.wait.operationName} exceeded maxDurationMs=${String(input.wait.maxDurationMs)}`,
        ),
      }),
    input.wait.maxDurationMs,
  );

const boundedAbortHandler =
  (input: {
    readonly state: BoundedWaitState;
    readonly signalOwned: (signal: NodeJS.Signals) => void;
    readonly wait: BoundedWaitInput;
    readonly signal?: AbortSignal;
    readonly reject: (error: unknown) => void;
  }): (() => void) =>
  () =>
    beginBoundedChildTermination({
      state: input.state,
      signalOwned: input.signalOwned,
      wait: input.wait,
      reason:
        input.signal?.reason ??
        new Error(`${input.wait.operationName} aborted`),
      reject: input.reject,
    });

const armBoundedChildWait = (input: {
  readonly child: ChildProcess;
  readonly state: BoundedWaitState;
  readonly signalOwned: (signal: NodeJS.Signals) => void;
  readonly wait: BoundedWaitInput;
  readonly signal?: AbortSignal;
  readonly onAbort: () => void;
  readonly onError: (error: Error) => void;
  readonly onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
  readonly reject: (error: unknown) => void;
}): void => {
  input.child.once("error", input.onError);
  input.child.once("exit", input.onExit);
  input.signal?.addEventListener("abort", input.onAbort, { once: true });
  if (input.child.exitCode !== null || input.child.signalCode !== null)
    input.onExit(input.child.exitCode, input.child.signalCode);
  if (!input.state.settled && input.signal?.aborted) input.onAbort();
  if (!input.state.settled)
    input.state.deadline = armBoundedChildDeadline({
      state: input.state,
      signalOwned: input.signalOwned,
      wait: input.wait,
      reject: input.reject,
    });
};

const waitForBoundedPlaywrightChild = (
  child: ChildProcess,
  signalOwned: (signal: NodeJS.Signals) => void,
  input: BoundedWaitInput,
  signal?: AbortSignal,
): Promise<number> =>
  new Promise<number>((resolve, reject) => {
    const state = initialBoundedWaitState();
    const cleanup = (): void => {
      if (state.deadline !== undefined) clearTimeout(state.deadline);
      if (state.escalation !== undefined) clearTimeout(state.escalation);
      child.off("error", onError);
      child.off("exit", onExit);
      signal?.removeEventListener("abort", onAbort);
    };
    const settleResolve = (exitCode: number): void => {
      if (state.settled) return;
      state.settled = true;
      cleanup();
      resolve(exitCode);
    };
    const settleReject = (error: unknown): void => {
      if (state.settled) return;
      state.settled = true;
      cleanup();
      reject(error);
    };
    const onAbort = boundedAbortHandler({
      state,
      signalOwned,
      wait: input,
      ...(signal === undefined ? {} : { signal }),
      reject: settleReject,
    });
    const onError = (error: Error): void => {
      if (state.timedOut) {
        state.terminationErrors.push(error);
        return;
      }
      settleReject(error);
    };
    const onExit = (
      code: number | null,
      exitSignal: NodeJS.Signals | null,
    ): void => {
      const failure = failureForChildExit({
        state,
        wait: input,
        code,
        signal: exitSignal,
      });
      if (failure !== undefined) {
        settleReject(failure);
        return;
      }
      settleResolve(code ?? 1);
    };
    armBoundedChildWait({
      child,
      state,
      signalOwned,
      wait: input,
      ...(signal === undefined ? {} : { signal }),
      onAbort,
      onError,
      onExit,
      reject: settleReject,
    });
  });

export const runBoundedPlaywrightChild = async (
  input: BoundedPlaywrightChildInput,
): Promise<number> => {
  if (input.signal?.aborted)
    throw input.signal.reason ?? new Error(`${input.operationName} aborted`);
  assertBoundedPlaywrightDuration(
    input.operationName,
    "maxDurationMs",
    input.maxDurationMs,
  );
  assertBoundedPlaywrightDuration(
    input.operationName,
    "terminationGraceMs",
    input.terminationGraceMs,
  );
  const launcher = launcherFor(input.operationName, input.environment);
  const owned = await spawnDetachedProcessGroup({
    operationName: input.operationName,
    command: launcher.command,
    args: boundedPlaywrightArgs(launcher.leadingArgs, input.configPath),
    repoRoot: input.repoRoot,
    environment: input.environment,
    closeGraceMs: input.terminationGraceMs,
  });
  try {
    const exitCode = await waitForBoundedPlaywrightChild(
      owned.child,
      owned.signal,
      input,
      input.signal,
    );
    await owned.close();
    input.onCleanup?.(
      preflightPlaywrightChildCleanupEvidenceFor(owned.ownership),
    );
    return exitCode;
  } catch (error: unknown) {
    return owned.abort(error);
  }
};
