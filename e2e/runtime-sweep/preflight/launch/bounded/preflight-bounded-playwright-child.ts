import { type ChildProcess } from "node:child_process";

import {
  launchNestedOwnedProcess,
  nestedProcessOwnershipFor,
} from "./preflight-nested-process-ownership.ts";

type BoundedPlaywrightChildInput = Readonly<{
  operationName: string;
  configPath: string;
  repoRoot: string;
  environment: NodeJS.ProcessEnv;
  maxDurationMs: number;
  terminationGraceMs: number;
  acceptNonzeroExit?: boolean;
}>;

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

const waitForBoundedPlaywrightChild = (
  child: ChildProcess,
  signalOwned: (signal: NodeJS.Signals) => void,
  input: Pick<
    BoundedPlaywrightChildInput,
    | "operationName"
    | "maxDurationMs"
    | "terminationGraceMs"
    | "acceptNonzeroExit"
  >,
): Promise<number> =>
  new Promise<number>((resolve, reject) => {
    const state: {
      timedOut: boolean;
      escalation: NodeJS.Timeout | undefined;
      terminationErrors: unknown[];
    } = { timedOut: false, escalation: undefined, terminationErrors: [] };
    const clearTimers = (): void => {
      clearTimeout(deadline);
      if (state.escalation !== undefined) clearTimeout(state.escalation);
    };
    const deadline = setTimeout(() => {
      state.timedOut = true;
      try {
        signalOwned("SIGINT");
      } catch (error: unknown) {
        state.terminationErrors.push(error);
      }
      state.escalation = setTimeout(() => {
        try {
          signalOwned("SIGKILL");
        } catch (error: unknown) {
          state.terminationErrors.push(error);
        }
        const timeoutError = new PreflightBoundedPlaywrightChildError(
          `${input.operationName} exceeded maxDurationMs=${String(input.maxDurationMs)}`,
        );
        reject(
          state.terminationErrors.length === 0
            ? timeoutError
            : new AggregateError(
                [timeoutError, ...state.terminationErrors],
                `${input.operationName} process-group termination failed`,
              ),
        );
      }, input.terminationGraceMs);
    }, input.maxDurationMs);
    child.once("error", (error) => {
      if (state.timedOut) {
        state.terminationErrors.push(error);
        return;
      }
      clearTimers();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (state.timedOut) return;
      clearTimers();
      if (code !== 0 && input.acceptNonzeroExit !== true) {
        reject(
          new PreflightBoundedPlaywrightChildError(
            `${input.operationName} child exited code=${String(code)} signal=${String(signal)}`,
          ),
        );
        return;
      }
      resolve(code ?? 1);
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
  const ownership = nestedProcessOwnershipFor(
    input.operationName,
    input.environment,
  );
  if (ownership === undefined)
    throw new PreflightBoundedPlaywrightChildError(
      `${input.operationName} bounded launch requires nested process ownership`,
    );
  const owned = await launchNestedOwnedProcess({
    operationName: input.operationName,
    ownership,
    command,
    args,
    repoRoot: input.repoRoot,
    environment: input.environment,
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
