import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";

import type { SeedProfile } from "../source/contracts.ts";
import type {
  RuntimeLane,
  RuntimeLaneAssignment,
} from "./runtime-lane-contract.ts";
import { runtimeLaneProfileEnvironment } from "./runtime-lane-profile-environment.ts";
import { runtimeLaneRedisRunId } from "./runtime-lane-readiness.ts";
import type { RuntimeLaneRunIdentity } from "./runtime-lane-run-identity.ts";
import type { RuntimeObservabilityConfig } from "./runtime-observability-readiness.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const PLAYWRIGHT_ARGS = [
  path.join(REPO_ROOT, "apps/web/node_modules/@playwright/test/cli.js"),
  "test",
  "--config",
  "e2e/runtime-sweep/preflight/playwright.config.ts",
  "--project",
  "runtime-live-controls",
  "--no-deps",
] as const;
const PROCESS_STOP_TIMEOUT_MS = 10_000;
const RUNTIME_LANE_HEALTH_INTERVAL_MS = 1000;
const ignoreRejectedCleanup = (): void => undefined;
const escalationTimers = new Map<number, NodeJS.Timeout>();

const signalProcessGroup = (
  pid: number | undefined,
  signal: NodeJS.Signals,
): void => {
  if (pid === undefined) return;
  try {
    process.kill(-pid, signal);
  } catch (error: unknown) {
    const code =
      error instanceof Error && "code" in error ? String(error.code) : "";
    if (code !== "ESRCH") throw error;
  }
};

const stopProcessGroup = (pid: number | undefined): void => {
  if (pid === undefined || escalationTimers.has(pid)) return;
  // Playwright owns SIGINT cleanup for its API and Next child processes.
  signalProcessGroup(pid, "SIGINT");
  const timer = setTimeout(() => {
    signalProcessGroup(pid, "SIGKILL");
    escalationTimers.delete(pid);
  }, PROCESS_STOP_TIMEOUT_MS);
  escalationTimers.set(pid, timer);
};

const clearEscalation = (pid: number | undefined): void => {
  if (pid === undefined) return;
  const timer = escalationTimers.get(pid);
  if (timer !== undefined) clearTimeout(timer);
  escalationTimers.delete(pid);
};

const redisUnavailableError = (
  lane: RuntimeLane,
  profile: SeedProfile,
  error: unknown,
): Error =>
  error instanceof Error
    ? new Error(
        `Runtime lane ${lane.laneId}/${profile} Redis became unavailable: ${error.message}`,
      )
    : new Error(
        `Runtime lane ${lane.laneId}/${profile} Redis became unavailable`,
      );

const monitorRuntimeLaneRedis = (
  lane: RuntimeLane,
  profile: SeedProfile,
  expectedRunId: string,
  onFailure: (error: Error) => void,
): NodeJS.Timeout =>
  setInterval(() => {
    void runtimeLaneRedisRunId(lane.redisPort)
      .then((currentRunId) => {
        if (currentRunId === expectedRunId) return;
        onFailure(
          new Error(
            `Runtime lane ${lane.laneId}/${profile} Redis identity changed during replay`,
          ),
        );
      })
      .catch((error: unknown) =>
        onFailure(redisUnavailableError(lane, profile, error)),
      );
  }, RUNTIME_LANE_HEALTH_INTERVAL_MS);

const abortReason = (abort: AbortSignal): Error =>
  abort.reason instanceof Error
    ? abort.reason
    : new Error(
        abort.reason === undefined
          ? "Runtime lane execution was aborted"
          : String(abort.reason),
      );

const childCompletionFor = (
  child: ChildProcess,
  lane: RuntimeLane,
  profile: SeedProfile,
): Promise<void> =>
  new Promise((resolve, reject) => {
    child.once("error", (error) => {
      clearEscalation(child.pid);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearEscalation(child.pid);
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `Runtime lane ${lane.laneId}/${profile} exited code=${String(code)} signal=${String(signal)}`,
          ),
        );
    });
  });

export const runRuntimeLaneProfileProcess = async (
  input: Readonly<{
    assignmentPath: string;
    assignment: RuntimeLaneAssignment;
    run: RuntimeLaneRunIdentity;
    lane: RuntimeLane;
    profile: SeedProfile;
    startedAt: string;
    baseDatabaseUrl: string;
    expectedRedisRunId: string;
    observability: RuntimeObservabilityConfig;
    abort: AbortSignal;
  }>,
): Promise<void> => {
  const child = spawn(process.execPath, [...PLAYWRIGHT_ARGS], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: "inherit",
    env: runtimeLaneProfileEnvironment(input),
  });
  const childCompletion = childCompletionFor(child, input.lane, input.profile);
  const stop = (): void => stopProcessGroup(child.pid);
  const redisFailure = new Promise<never>((_resolve, reject) => {
    const monitor = monitorRuntimeLaneRedis(
      input.lane,
      input.profile,
      input.expectedRedisRunId,
      (error) => {
        stop();
        reject(error);
      },
    );
    childCompletion
      .finally(() => clearInterval(monitor))
      .catch(ignoreRejectedCleanup);
  });
  const abortFailure = new Promise<never>((_resolve, reject) => {
    const rejectAbort = (): void => {
      stop();
      reject(abortReason(input.abort));
    };
    if (input.abort.aborted) rejectAbort();
    else input.abort.addEventListener("abort", rejectAbort, { once: true });
    childCompletion
      .finally(() => input.abort.removeEventListener("abort", rejectAbort))
      .catch(ignoreRejectedCleanup);
  });
  try {
    await Promise.race([childCompletion, redisFailure, abortFailure]);
  } catch (error: unknown) {
    stop();
    await childCompletion.catch(ignoreRejectedCleanup);
    throw error;
  }
};
