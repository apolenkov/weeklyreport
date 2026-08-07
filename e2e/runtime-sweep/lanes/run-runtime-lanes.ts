import { spawn } from "node:child_process";
import path from "node:path";

import type { SeedProfile } from "../source/contracts.ts";
import type {
  RuntimeLane,
  RuntimeLaneAssignment,
} from "./runtime-lane-contract.ts";
import { prepareRuntimeLaneArchives } from "./runtime-lane-files.ts";
import {
  assertRuntimeLaneReadiness,
  runtimeLaneDatabaseUrl,
} from "./runtime-lane-readiness.ts";

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

const profilesFor = (lane: RuntimeLane): readonly SeedProfile[] => [
  ...new Set(lane.groups.map(({ profile }) => profile)),
];

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
  signalProcessGroup(pid, "SIGTERM");
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

const runProfile = (
  assignmentPath: string,
  assignment: RuntimeLaneAssignment,
  lane: RuntimeLane,
  profile: SeedProfile,
  baseDatabaseUrl: string,
  abort: AbortSignal,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...PLAYWRIGHT_ARGS], {
      cwd: REPO_ROOT,
      detached: true,
      stdio: "inherit",
      env: {
        ...process.env,
        E2E_API_PORT: String(lane.apiPort),
        E2E_WEB_PORT: String(lane.webPort),
        E2E_DATABASE_URL: runtimeLaneDatabaseUrl(
          baseDatabaseUrl,
          lane.databaseName,
        ),
        E2E_REDIS_FLUSH: "true",
        E2E_SEED_PROFILE: profile,
        REDIS_HOST: "127.0.0.1",
        REDIS_PORT: String(lane.redisPort),
        RUNTIME_SWEEP_API_PORT: String(lane.apiPort),
        RUNTIME_SWEEP_WEB_PORT: String(lane.webPort),
        RUNTIME_SWEEP_ARCHIVE: lane.archiveRoot,
        RUNTIME_SWEEP_PROFILE: profile,
        RUNTIME_SWEEP_SOURCE_SHA: assignment.sourceSha,
        RUNTIME_SWEEP_LANE_ASSIGNMENT: assignmentPath,
        RUNTIME_SWEEP_LANE_ID: lane.laneId,
        RUNTIME_SWEEP_REUSE_DATABASE: "false",
        BULLMQ_PREFIX: `customreport-runtime-${lane.laneId}-${profile}`,
      },
    });
    const stop = (): void => stopProcessGroup(child.pid);
    abort.addEventListener("abort", stop, { once: true });
    child.once("error", (error) => {
      abort.removeEventListener("abort", stop);
      clearEscalation(child.pid);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      abort.removeEventListener("abort", stop);
      if (code === 0) {
        clearEscalation(child.pid);
        resolve();
      } else {
        stopProcessGroup(child.pid);
        reject(
          new Error(
            `Runtime lane ${lane.laneId}/${profile} exited code=${String(code)} signal=${String(signal)}`,
          ),
        );
      }
    });
  });

const runLane = async (
  assignmentPath: string,
  assignment: RuntimeLaneAssignment,
  lane: RuntimeLane,
  baseDatabaseUrl: string,
  abort: AbortSignal,
): Promise<void> => {
  for (const profile of profilesFor(lane)) {
    if (abort.aborted) throw abort.reason;
    await runProfile(
      assignmentPath,
      assignment,
      lane,
      profile,
      baseDatabaseUrl,
      abort,
    );
  }
};

export async function runRuntimeLanes(
  input: Readonly<{
    readonly assignmentPath: string;
    readonly assignment: RuntimeLaneAssignment;
    readonly baseDatabaseUrl: string;
  }>,
): Promise<void> {
  await assertRuntimeLaneReadiness({
    assignment: input.assignment,
    baseDatabaseUrl: input.baseDatabaseUrl,
  });
  await prepareRuntimeLaneArchives(input.assignment);
  const execution = new AbortController();
  await Promise.all(
    input.assignment.lanes
      .filter(({ groups }) => groups.length > 0)
      .map((lane) =>
        runLane(
          input.assignmentPath,
          input.assignment,
          lane,
          input.baseDatabaseUrl,
          execution.signal,
        ).catch((error: unknown) => {
          execution.abort(error);
          throw error;
        }),
      ),
  );
}
