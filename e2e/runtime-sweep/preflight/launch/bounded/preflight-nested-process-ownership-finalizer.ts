import type { ChildProcess } from "node:child_process";
import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";

import {
  assertOwnedProcessResult,
  type OwnedProcessReady,
} from "./preflight-nested-process-ownership-protocol.ts";

const COMMAND_TIMEOUT_MS = 5000;
const CHILD_EXIT_GRACE_MS = 1000;
const REGISTRY_FLAG = "--registry";
const EXPECTED_CWD_FLAG = "--expected-cwd";

export type NestedProcessOwnershipPaths = Readonly<{
  readonly readyPath: string;
  readonly armPath: string;
  readonly resultPath: string;
}>;

export type NestedProcessOwnershipFinalizerInput = Readonly<{
  readonly operationName: string;
  readonly ownership: Readonly<{
    readonly registry: string;
    readonly registryTool: string;
    readonly rollbackTool: string;
  }>;
  readonly paths: NestedProcessOwnershipPaths;
  readonly child: ChildProcess;
  readonly repoRoot: string;
  readonly ready: () => OwnedProcessReady | undefined;
  readonly armDigest: () => string | undefined;
}>;

type NestedProcessOwnershipCommandInput = Readonly<{
  readonly operationName: string;
  readonly ownership: Readonly<{
    readonly registry: string;
    readonly registryTool: string;
    readonly rollbackTool: string;
  }>;
  readonly paths: NestedProcessOwnershipPaths;
  readonly repoRoot: string;
}>;

export type NestedProcessOwnershipHandle = Readonly<{
  readonly child: ChildProcess;
  readonly signal: (signal: NodeJS.Signals) => void;
  readonly close: () => Promise<void>;
  readonly abort: (primary: unknown) => Promise<never>;
}>;

class NestedProcessOwnershipFinalizerError extends Error {
  override readonly name = "NestedProcessOwnershipFinalizerError";
}

const errorFor = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const commandFor = (
  input: NestedProcessOwnershipCommandInput,
  command: string,
  args: readonly string[],
): void => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: COMMAND_TIMEOUT_MS,
    env: {},
  });
  if (result.status !== 0 || result.signal !== null)
    throw new NestedProcessOwnershipFinalizerError(
      `${input.operationName} nested process ownership command failed`,
    );
};

const assertState = (
  input: NestedProcessOwnershipCommandInput,
  state: "registered" | "gone",
): void => {
  commandFor(input, process.execPath, [
    input.ownership.registryTool,
    state === "registered" ? "--assert-ready" : "--assert-gone-ready",
    input.paths.readyPath,
    REGISTRY_FLAG,
    input.ownership.registry,
    EXPECTED_CWD_FLAG,
    input.repoRoot,
  ]);
};

export const assertNestedProcessRegistered = (
  input: NestedProcessOwnershipCommandInput,
): void => assertState(input, "registered");

const rollback = (
  input: NestedProcessOwnershipCommandInput,
  signal: NodeJS.Signals,
): void => {
  commandFor(input, process.execPath, [
    input.ownership.rollbackTool,
    "--signal-ready",
    input.paths.readyPath,
    REGISTRY_FLAG,
    input.ownership.registry,
    EXPECTED_CWD_FLAG,
    input.repoRoot,
    "--signal",
    signal,
  ]);
};

const childIsAlive = (child: ChildProcess): boolean =>
  child.exitCode === null && child.signalCode === null;

const waitForChildExit = async (child: ChildProcess): Promise<boolean> => {
  if (!childIsAlive(child)) return true;
  if (typeof child.once !== "function") return false;
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), CHILD_EXIT_GRACE_MS);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
    child.once("error", () => {
      clearTimeout(timer);
      resolve(!childIsAlive(child));
    });
  });
};

interface FinalizationState {
  readonly successfulSignals: Set<NodeJS.Signals>;
  goneProven: boolean;
  closed: boolean;
  closePromise: Promise<void> | undefined;
}

const combineFailures = (
  operationName: string,
  failures: readonly unknown[],
): Error | undefined => {
  if (failures.length === 0) return undefined;
  if (failures.length === 1) return errorFor(failures[0]);
  return new AggregateError(
    failures.map(errorFor),
    `${operationName} nested process ownership finalization failed`,
  );
};

const removeHandshakeFiles = async (
  input: NestedProcessOwnershipFinalizerInput,
): Promise<void> => {
  const failures: unknown[] = [];
  for (const filePath of Object.values(input.paths)) {
    try {
      await rm(filePath, { force: true });
    } catch (error: unknown) {
      failures.push(error);
    }
  }
  const failure = combineFailures(
    input.operationName,
    failures.map(
      (error) =>
        new NestedProcessOwnershipFinalizerError(
          `${input.operationName} handshake cleanup failed: ${errorFor(error).message}`,
        ),
    ),
  );
  if (failure !== undefined) throw failure;
};

const rollbackFailureFor = (
  input: NestedProcessOwnershipFinalizerInput,
  state: FinalizationState,
  forceRollback: boolean,
): Error | undefined => {
  if (!forceRollback && !childIsAlive(input.child)) return undefined;
  if (state.successfulSignals.has("SIGTERM")) return undefined;
  try {
    rollback(input, "SIGTERM");
    state.successfulSignals.add("SIGTERM");
    return undefined;
  } catch (error: unknown) {
    return errorFor(error);
  }
};

const ensureRolledBack = async (
  input: NestedProcessOwnershipFinalizerInput,
  state: FinalizationState,
  forceRollback: boolean,
): Promise<Error[]> => {
  const failures: Error[] = [];
  const rollbackFailure = rollbackFailureFor(input, state, forceRollback);
  if (rollbackFailure !== undefined) {
    failures.push(rollbackFailure);
    return failures;
  }
  if (typeof input.child.once !== "function") return failures;
  if (await waitForChildExit(input.child)) return failures;
  try {
    rollback(input, "SIGKILL");
    state.successfulSignals.add("SIGKILL");
  } catch (error: unknown) {
    failures.push(errorFor(error));
    return failures;
  }
  if (!(await waitForChildExit(input.child)))
    failures.push(
      new NestedProcessOwnershipFinalizerError(
        `${input.operationName} launcher did not exit after birth-bound rollback`,
      ),
    );
  return failures;
};

const goneFailureFor = (
  input: NestedProcessOwnershipFinalizerInput,
  state: FinalizationState,
): Error | undefined => {
  if (state.goneProven) return undefined;
  try {
    assertState(input, "gone");
    state.goneProven = true;
    return undefined;
  } catch (error: unknown) {
    return errorFor(error);
  }
};

const resultFailureFor = async (
  input: NestedProcessOwnershipFinalizerInput,
  state: FinalizationState,
  ready: OwnedProcessReady | undefined,
): Promise<Error | undefined> => {
  const armDigest = input.armDigest();
  if (
    ready === undefined ||
    state.successfulSignals.size > 0 ||
    armDigest === undefined
  )
    return undefined;
  try {
    await assertOwnedProcessResult({
      operationName: input.operationName,
      resultPath: input.paths.resultPath,
      ready,
      armDigest,
      child: input.child,
    });
    return undefined;
  } catch (error: unknown) {
    return errorFor(error);
  }
};

const postGoneFailuresFor = async (
  input: NestedProcessOwnershipFinalizerInput,
  state: FinalizationState,
  ready: OwnedProcessReady | undefined,
): Promise<Error[]> => {
  const failures: Error[] = [];
  const resultFailure = await resultFailureFor(input, state, ready);
  if (resultFailure !== undefined) failures.push(resultFailure);
  try {
    await removeHandshakeFiles(input);
  } catch (error: unknown) {
    failures.push(errorFor(error));
  }
  return failures;
};

const finalizeNestedOwnedProcess = async (
  input: NestedProcessOwnershipFinalizerInput,
  state: FinalizationState,
  forceRollback: boolean,
): Promise<void> => {
  if (state.closed) return;
  const ready = input.ready();
  const failures: unknown[] = [];
  failures.push(...(await ensureRolledBack(input, state, forceRollback)));
  if (failures.length === 0) {
    const goneFailure = goneFailureFor(input, state);
    if (goneFailure !== undefined) failures.push(goneFailure);
  }
  if (state.goneProven) {
    failures.push(...(await postGoneFailuresFor(input, state, ready)));
  }
  const failure = combineFailures(input.operationName, failures);
  if (failure !== undefined) throw failure;
  state.closed = true;
};

export const createNestedProcessOwnershipFinalizer = (
  input: NestedProcessOwnershipFinalizerInput,
): NestedProcessOwnershipHandle => {
  const state: FinalizationState = {
    successfulSignals: new Set<NodeJS.Signals>(),
    goneProven: false,
    closed: false,
    closePromise: undefined,
  };

  const signal = (requestedSignal: NodeJS.Signals): void => {
    if (state.successfulSignals.has(requestedSignal)) return;
    rollback(input, requestedSignal);
    state.successfulSignals.add(requestedSignal);
  };

  const close = async (): Promise<void> => {
    if (state.closed) return;
    if (state.closePromise !== undefined) return state.closePromise;
    const current = finalizeNestedOwnedProcess(input, state, false).finally(
      () => {
        if (!state.closed) state.closePromise = undefined;
      },
    );
    state.closePromise = current;
    return current;
  };

  const abort = async (primary: unknown): Promise<never> => {
    try {
      await finalizeNestedOwnedProcess(input, state, true);
    } catch (cleanupError: unknown) {
      throw new AggregateError(
        [errorFor(primary), errorFor(cleanupError)],
        `${input.operationName} nested process setup failed and cleanup failed`,
      );
    }
    throw errorFor(primary);
  };

  return { child: input.child, signal, close, abort };
};
