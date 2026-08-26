import { type ChildProcess, spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

import {
  assertSpawnOwnership,
  groupOwnershipFor,
  leaderOwnershipFor,
  ownershipFor,
  ProcessGroupCleanupError,
  type ProcessGroupOwnership,
  processGroupStatusFor,
  signalProcessGroup,
  terminateUnownedLeader,
} from "./preflight-detached-process-group-ownership.ts";

export {
  assertSpawnOwnership,
  classifyProcessGroupPermission,
  type ProcessGroupCleanupClassification,
  ProcessGroupCleanupError,
  type ProcessGroupLeaderOwnership,
  type ProcessGroupMemberOwnership,
  type ProcessGroupOwnership,
} from "./preflight-detached-process-group-ownership.ts";

const PROCESS_POLL_MS = 20;
const DEFAULT_CLOSE_GRACE_MS = 1000;

const waitForProcessGroupExit = async (
  input: {
    readonly operationName: string;
    readonly child: ChildProcess;
    readonly ownership: ProcessGroupOwnership;
  },
  maxDurationMs: number,
): Promise<boolean> => {
  const deadline = performance.now() + maxDurationMs;
  while (
    processGroupStatusFor(input) === "LIVE" &&
    performance.now() < deadline
  )
    await new Promise((resolve) => setTimeout(resolve, PROCESS_POLL_MS));
  return processGroupStatusFor(input) === "GONE";
};

const errorFor = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const rootFailureFor = (error: Error): Error => {
  if (!(error instanceof AggregateError)) return error;
  const failures = error.errors as readonly unknown[];
  const first = failures[0];
  return first === undefined ? error : rootFailureFor(errorFor(first));
};

export const combineFailures = (
  operationName: string,
  primary: unknown,
  cleanupFailures: readonly unknown[],
): Error => {
  if (cleanupFailures.length === 0) return errorFor(primary);
  const primaryError = errorFor(primary);
  const rootPrimary = rootFailureFor(primaryError);
  return new AggregateError(
    [primaryError, ...cleanupFailures.map(errorFor)],
    `${rootPrimary.message}; ${operationName} secondary cleanup failures=${String(cleanupFailures.length)}`,
    { cause: rootPrimary },
  );
};

const residueErrorFor = (operationName: string): Error =>
  new Error(
    `${operationName} leader exited with live process-group descendants`,
  );

const childIsRunning = (child: ChildProcess): boolean =>
  child.exitCode === null && child.signalCode === null;

const signalWhileLeaderLives = (
  operationName: string,
  child: ChildProcess,
  ownership: ProcessGroupOwnership,
  signal: NodeJS.Signals,
): void => {
  const processGroupStatus = processGroupStatusFor({
    operationName,
    child,
    ownership,
  });
  if (processGroupStatus === "GONE") return;
  if (!childIsRunning(child)) {
    throw new Error(
      `${operationName} cannot signal an exited process-group leader`,
    );
  }
  if (leaderOwnershipFor({ child, ownership }) !== "LIVE")
    throw new ProcessGroupCleanupError(
      operationName,
      "OWNERSHIP_UNPROVEN",
      "process-group leader ownership could not be revalidated",
    );
  if (groupOwnershipFor({ operationName, ownership }) !== "OWNED")
    throw new ProcessGroupCleanupError(
      operationName,
      "OWNERSHIP_UNPROVEN",
      "process-group membership could not be proven fully owned",
    );
  signalProcessGroup({ operationName, child, ownership, signal });
};

type ProcessGroupControlInput = Readonly<{
  readonly operationName: string;
  readonly child: ChildProcess;
  readonly ownership: ProcessGroupOwnership;
  readonly closeGraceMs: number;
}>;

const processGroupExitInputFor = (
  input: ProcessGroupControlInput,
): Omit<ProcessGroupControlInput, "closeGraceMs"> => ({
  operationName: input.operationName,
  child: input.child,
  ownership: input.ownership,
});

const closeProcessGroup = async (
  input: ProcessGroupControlInput,
  signal: (value: NodeJS.Signals) => void,
): Promise<void> => {
  const exitInput = processGroupExitInputFor(input);
  if (await waitForProcessGroupExit(exitInput, input.closeGraceMs)) return;
  if (!childIsRunning(input.child)) throw residueErrorFor(input.operationName);
  signal("SIGTERM");
  await waitForChildExit(input.child, input.closeGraceMs);
  if (await waitForProcessGroupExit(exitInput, input.closeGraceMs)) return;
  if (!childIsRunning(input.child)) throw residueErrorFor(input.operationName);
  signal("SIGKILL");
  await waitForChildExit(input.child, input.closeGraceMs);
  if (!(await waitForProcessGroupExit(exitInput, input.closeGraceMs)))
    throw new Error(`${input.operationName} process group did not exit`);
};

const abortProcessGroup = async (
  input: ProcessGroupControlInput,
  signal: (value: NodeJS.Signals) => void,
  primary: unknown,
): Promise<never> => {
  const cleanupFailures: unknown[] = [];
  const exitInput = processGroupExitInputFor(input);
  try {
    if (childIsRunning(input.child)) {
      signal("SIGTERM");
      await waitForChildExit(input.child, input.closeGraceMs);
    }
    if (!(await waitForProcessGroupExit(exitInput, input.closeGraceMs))) {
      if (!childIsRunning(input.child))
        cleanupFailures.push(residueErrorFor(input.operationName));
      else {
        signal("SIGKILL");
        await waitForChildExit(input.child, input.closeGraceMs);
        if (!(await waitForProcessGroupExit(exitInput, input.closeGraceMs)))
          cleanupFailures.push(
            new Error(`${input.operationName} process group survived SIGKILL`),
          );
      }
    }
  } catch (error: unknown) {
    cleanupFailures.push(error);
  }
  throw combineFailures(input.operationName, primary, cleanupFailures);
};

const waitForChildExit = async (
  child: ChildProcess,
  maxDurationMs: number,
): Promise<boolean> => {
  if (!childIsRunning(child)) return true;
  return new Promise<boolean>((resolve) => {
    const state = { settled: false };
    const settle = (exited: boolean): void => {
      if (state.settled) return;
      state.settled = true;
      clearTimeout(timer);
      child.off("exit", onExit);
      child.off("error", onError);
      resolve(exited);
    };
    const onExit = (): void => settle(true);
    const onError = (): void => settle(true);
    const timer = setTimeout(
      () => settle(!childIsRunning(child)),
      maxDurationMs,
    );
    child.once("exit", onExit);
    child.once("error", onError);
    if (!childIsRunning(child)) settle(true);
  });
};

const waitForSpawn = (
  operationName: string,
  child: ChildProcess,
): Promise<number> =>
  new Promise<number>((resolve, reject) => {
    const cleanup = (): void => {
      child.off("spawn", onSpawn);
      child.off("error", onError);
    };
    const onSpawn = (): void => {
      cleanup();
      if (child.pid === undefined) {
        reject(new Error(`${operationName} spawned without a child pid`));
        return;
      }
      resolve(child.pid);
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    child.once("spawn", onSpawn);
    child.once("error", onError);
  });

export const withoutLegacyOwnershipEnvironment = (
  environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(environment).filter(
      ([key]) =>
        !key.startsWith("RUNTIME_SWEEP_NESTED_") &&
        !key.startsWith("CR001_OWNED_"),
    ),
  );

export type DetachedProcessGroupHandle = Readonly<{
  readonly child: ChildProcess;
  readonly ownership: ProcessGroupOwnership;
  readonly signal: (signal: NodeJS.Signals) => void;
  readonly close: () => Promise<void>;
  readonly abort: (primary: unknown) => Promise<never>;
}>;

const processGroupControlsFor = (
  input: ProcessGroupControlInput,
): Omit<DetachedProcessGroupHandle, "child" | "ownership"> => {
  const signal = (value: NodeJS.Signals): void =>
    signalWhileLeaderLives(
      input.operationName,
      input.child,
      input.ownership,
      value,
    );

  return {
    signal,
    close: () => closeProcessGroup(input, signal),
    abort: (primary) => abortProcessGroup(input, signal, primary),
  };
};

export const spawnDetachedProcessGroup = async (input: {
  readonly operationName: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly repoRoot: string;
  /**
   * An explicitly owned working directory for a process that is not launched
   * from the repository root.  The default preserves the original launcher
   * contract for Playwright and all existing callers.
   */
  readonly cwd?: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly closeGraceMs?: number;
}): Promise<DetachedProcessGroupHandle> => {
  const child = spawn(input.command, [...input.args], {
    cwd: input.cwd ?? input.repoRoot,
    detached: true,
    env: withoutLegacyOwnershipEnvironment(input.environment),
    stdio: "inherit",
  });
  const processGroupId = await waitForSpawn(input.operationName, child);
  const closeGraceMs = Math.max(
    input.closeGraceMs ?? DEFAULT_CLOSE_GRACE_MS,
    DEFAULT_CLOSE_GRACE_MS,
  );
  const ownership = ownershipFor(processGroupId);
  try {
    assertSpawnOwnership({
      operationName: input.operationName,
      ownership,
    });
  } catch (error: unknown) {
    const cleanupFailures = await terminateUnownedLeader({
      operationName: input.operationName,
      child,
      closeGraceMs,
    });
    throw combineFailures(input.operationName, error, cleanupFailures);
  }

  return {
    child,
    ownership,
    ...processGroupControlsFor({
      operationName: input.operationName,
      child,
      ownership,
      closeGraceMs,
    }),
  };
};
