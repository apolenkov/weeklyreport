import { type ChildProcess, spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const PROCESS_POLL_MS = 20;
const DEFAULT_CLOSE_GRACE_MS = 1000;

const isMissingProcess = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ESRCH";

const processGroupExists = (processGroupId: number): boolean => {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error: unknown) {
    if (isMissingProcess(error)) return false;
    throw error;
  }
};

const signalProcessGroup = (
  processGroupId: number,
  signal: NodeJS.Signals,
): void => {
  try {
    process.kill(-processGroupId, signal);
  } catch (error: unknown) {
    if (!isMissingProcess(error)) throw error;
  }
};

const waitForProcessGroupExit = async (
  processGroupId: number,
  maxDurationMs: number,
): Promise<boolean> => {
  const deadline = performance.now() + maxDurationMs;
  while (processGroupExists(processGroupId) && performance.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, PROCESS_POLL_MS));
  return !processGroupExists(processGroupId);
};

const errorFor = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const combineFailures = (
  operationName: string,
  primary: unknown,
  cleanupFailures: readonly unknown[],
): Error => {
  if (cleanupFailures.length === 0) return errorFor(primary);
  return new AggregateError(
    [errorFor(primary), ...cleanupFailures.map(errorFor)],
    `${operationName} process-group cleanup failed after: ${errorFor(primary).message}`,
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
  processGroupId: number,
  signal: NodeJS.Signals,
): void => {
  if (!childIsRunning(child)) {
    if (!processGroupExists(processGroupId)) return;
    throw new Error(
      `${operationName} cannot signal an exited process-group leader`,
    );
  }
  signalProcessGroup(processGroupId, signal);
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
  readonly signal: (signal: NodeJS.Signals) => void;
  readonly close: () => Promise<void>;
  readonly abort: (primary: unknown) => Promise<never>;
}>;

const processGroupControlsFor = (input: {
  readonly operationName: string;
  readonly child: ChildProcess;
  readonly processGroupId: number;
  readonly closeGraceMs: number;
}): Omit<DetachedProcessGroupHandle, "child"> => {
  const signal = (value: NodeJS.Signals): void =>
    signalWhileLeaderLives(
      input.operationName,
      input.child,
      input.processGroupId,
      value,
    );

  const close = async (): Promise<void> => {
    if (await waitForProcessGroupExit(input.processGroupId, input.closeGraceMs))
      return;
    if (!childIsRunning(input.child))
      throw residueErrorFor(input.operationName);
    signal("SIGTERM");
    await waitForChildExit(input.child, input.closeGraceMs);
    if (await waitForProcessGroupExit(input.processGroupId, input.closeGraceMs))
      return;
    if (!childIsRunning(input.child))
      throw residueErrorFor(input.operationName);
    signal("SIGKILL");
    await waitForChildExit(input.child, input.closeGraceMs);
    if (
      !(await waitForProcessGroupExit(input.processGroupId, input.closeGraceMs))
    )
      throw new Error(`${input.operationName} process group did not exit`);
  };

  const abort = async (primary: unknown): Promise<never> => {
    const cleanupFailures: unknown[] = [];
    try {
      if (childIsRunning(input.child)) {
        signal("SIGTERM");
        await waitForChildExit(input.child, input.closeGraceMs);
      }
      if (
        !(await waitForProcessGroupExit(
          input.processGroupId,
          input.closeGraceMs,
        ))
      ) {
        if (!childIsRunning(input.child)) {
          cleanupFailures.push(residueErrorFor(input.operationName));
        } else {
          signal("SIGKILL");
          await waitForChildExit(input.child, input.closeGraceMs);
          if (
            !(await waitForProcessGroupExit(
              input.processGroupId,
              input.closeGraceMs,
            ))
          )
            cleanupFailures.push(
              new Error(
                `${input.operationName} process group survived SIGKILL`,
              ),
            );
        }
      }
    } catch (error: unknown) {
      cleanupFailures.push(error);
    }
    throw combineFailures(input.operationName, primary, cleanupFailures);
  };

  return { signal, close, abort };
};

export const spawnDetachedProcessGroup = async (input: {
  readonly operationName: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly repoRoot: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly closeGraceMs?: number;
}): Promise<DetachedProcessGroupHandle> => {
  const child = spawn(input.command, [...input.args], {
    cwd: input.repoRoot,
    detached: true,
    env: withoutLegacyOwnershipEnvironment(input.environment),
    stdio: "inherit",
  });
  const processGroupId = await waitForSpawn(input.operationName, child);
  const closeGraceMs = Math.max(
    input.closeGraceMs ?? DEFAULT_CLOSE_GRACE_MS,
    DEFAULT_CLOSE_GRACE_MS,
  );

  return {
    child,
    ...processGroupControlsFor({
      operationName: input.operationName,
      child,
      processGroupId,
      closeGraceMs,
    }),
  };
};
