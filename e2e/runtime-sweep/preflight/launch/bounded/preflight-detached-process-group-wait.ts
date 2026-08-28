import type { ChildProcess } from "node:child_process";
import { performance } from "node:perf_hooks";

import {
  ProcessGroupCleanupError,
  type ProcessGroupOwnership,
  processGroupStatusFor,
} from "./preflight-detached-process-group-ownership.ts";

const PROCESS_POLL_MS = 20;

const childIsRunning = (child: ChildProcess): boolean =>
  child.exitCode === null && child.signalCode === null;

const transientExitedLeaderFailure = (
  child: ChildProcess,
  error: unknown,
): ProcessGroupCleanupError | undefined =>
  !childIsRunning(child) &&
  error instanceof ProcessGroupCleanupError &&
  error.classification === "OWNERSHIP_UNPROVEN"
    ? error
    : undefined;

type ExitProbeInput = Readonly<{
  readonly operationName: string;
  readonly child: ChildProcess;
  readonly ownership: ProcessGroupOwnership;
}>;

const pollForProcessGroupExit = async (input: {
  readonly probe: ExitProbeInput;
  readonly deadline: number;
  readonly lastTransientFailure?: ProcessGroupCleanupError;
}): Promise<boolean> => {
  const observation = (() => {
    try {
      return { status: processGroupStatusFor(input.probe) } as const;
    } catch (error: unknown) {
      const transient = transientExitedLeaderFailure(input.probe.child, error);
      if (transient === undefined) throw error;
      return { status: "TRANSIENT", failure: transient } as const;
    }
  })();
  if (observation.status === "GONE") return true;
  if (performance.now() >= input.deadline) {
    if (observation.status === "TRANSIENT") throw observation.failure;
    if (input.lastTransientFailure !== undefined)
      throw input.lastTransientFailure;
    return false;
  }
  await new Promise((resolve) => setTimeout(resolve, PROCESS_POLL_MS));
  return pollForProcessGroupExit({
    probe: input.probe,
    deadline: input.deadline,
    ...(observation.status === "TRANSIENT"
      ? { lastTransientFailure: observation.failure }
      : {}),
  });
};

export const waitForProcessGroupExit = (
  input: ExitProbeInput,
  maxDurationMs: number,
): Promise<boolean> =>
  pollForProcessGroupExit({
    probe: input,
    deadline: performance.now() + maxDurationMs,
  });
