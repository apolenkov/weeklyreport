import { type ChildProcess } from "node:child_process";

import { spawnDetachedProcessGroup } from "./preflight-detached-process-group.ts";

type BoundedPlaywrightChildInput = Readonly<{
  operationName: string;
  configPath: string;
  repoRoot: string;
  environment: NodeJS.ProcessEnv;
  maxDurationMs: number;
  terminationGraceMs: number;
  acceptNonzeroExit?: boolean;
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

export const boundedPlaywrightArgs = (
  leadingArgs: readonly string[],
  configPath: string,
): readonly string[] => [
  ...leadingArgs,
  "--filter",
  "@customreport/web",
  "exec",
  "playwright",
  "test",
  "--config",
  configPath,
];

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

const timeoutFailureFor = (
  input: BoundedWaitInput,
  terminationErrors: readonly unknown[],
): Error => {
  const timeoutError = new PreflightBoundedPlaywrightChildError(
    `${input.operationName} exceeded maxDurationMs=${String(input.maxDurationMs)}`,
  );
  return terminationErrors.length === 0
    ? timeoutError
    : new AggregateError(
        [timeoutError, ...terminationErrors],
        `${input.operationName} process-group termination failed`,
      );
};

const armBoundedChildTimeout = (input: {
  readonly state: BoundedWaitState;
  readonly signalOwned: (signal: NodeJS.Signals) => void;
  readonly wait: BoundedWaitInput;
  readonly reject: (error: unknown) => void;
}): NodeJS.Timeout =>
  setTimeout(() => {
    input.state.timedOut = true;
    signalOrRecord(input.signalOwned, "SIGINT", input.state.terminationErrors);
    input.state.escalation = setTimeout(() => {
      signalOrRecord(
        input.signalOwned,
        "SIGKILL",
        input.state.terminationErrors,
      );
      input.reject(
        timeoutFailureFor(input.wait, input.state.terminationErrors),
      );
    }, input.wait.terminationGraceMs);
  }, input.wait.maxDurationMs);

const waitForBoundedPlaywrightChild = (
  child: ChildProcess,
  signalOwned: (signal: NodeJS.Signals) => void,
  input: BoundedWaitInput,
): Promise<number> =>
  new Promise<number>((resolve, reject) => {
    const state: BoundedWaitState = {
      timedOut: false,
      settled: false,
      deadline: undefined,
      escalation: undefined,
      terminationErrors: [],
    };
    const cleanup = (): void => {
      if (state.deadline !== undefined) clearTimeout(state.deadline);
      if (state.escalation !== undefined) clearTimeout(state.escalation);
      child.off("error", onError);
      child.off("exit", onExit);
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
    const onError = (error: Error): void => {
      if (state.timedOut) {
        state.terminationErrors.push(error);
        return;
      }
      settleReject(error);
    };
    const onExit = (
      code: number | null,
      signal: NodeJS.Signals | null,
    ): void => {
      if (state.timedOut) return;
      if (code !== 0 && input.acceptNonzeroExit !== true) {
        settleReject(
          new PreflightBoundedPlaywrightChildError(
            `${input.operationName} child exited code=${String(code)} signal=${String(signal)}`,
          ),
        );
        return;
      }
      settleResolve(code ?? 1);
    };
    child.once("error", onError);
    child.once("exit", onExit);
    if (child.exitCode !== null || child.signalCode !== null)
      onExit(child.exitCode, child.signalCode);
    if (!state.settled)
      state.deadline = armBoundedChildTimeout({
        state,
        signalOwned,
        wait: input,
        reject: settleReject,
      });
  });

export const runBoundedPlaywrightChild = async (
  input: BoundedPlaywrightChildInput,
): Promise<number> => {
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
  const command = launcher.command;
  const args = [
    ...boundedPlaywrightArgs(launcher.leadingArgs, input.configPath),
  ];
  const owned = await spawnDetachedProcessGroup({
    operationName: input.operationName,
    command,
    args,
    repoRoot: input.repoRoot,
    environment: input.environment,
    closeGraceMs: input.terminationGraceMs,
  });
  try {
    const exitCode = await waitForBoundedPlaywrightChild(
      owned.child,
      owned.signal,
      input,
    );
    await owned.close();
    return exitCode;
  } catch (error: unknown) {
    return owned.abort(error);
  }
};
