import { type ChildProcess, spawn } from "node:child_process";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

const MAX_SURVEY_ACTIONS = 131_072;
const CHILD_CLOSE_TIMEOUT_MS = 10_000;

const waitForChildClose = async (
  child: ChildProcess,
  timeoutMs: number,
): Promise<number> => {
  let timer: NodeJS.Timeout | undefined;
  let spawnError: Error | undefined;
  const closed = new Promise<
    Readonly<{ code: number | null; signal: NodeJS.Signals | null }>
  >((resolve) => {
    child.once("error", (error) => {
      spawnError = error;
    });
    child.once("close", (code, signal) => {
      resolve({ code, signal });
    });
  });
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(`Child process exceeded timeoutMs=${String(timeoutMs)}`),
      );
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([closed, timedOut]);
    if (spawnError !== undefined) throw spawnError;
    return result.code ?? -1;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
    await closed;
  }
};

describe("preflight reveal queue lifecycle", () => {
  it("kills and reaps a stalled child at its local deadline", async () => {
    const child = spawn(
      process.execPath,
      ["-e", "setInterval(() => undefined, 1000);"],
      { cwd: process.cwd(), stdio: "ignore" },
    );

    await expect(waitForChildClose(child, 25)).rejects.toThrow(
      /exceeded timeoutMs=25/iu,
    );
    expect(child.signalCode).toBe("SIGKILL");
  });

  it("processes the maximum candidate count without an adopted Promise chain", async () => {
    const moduleUrl = pathToFileURL(
      path.resolve(
        "e2e/runtime-sweep/preflight/reveal/interaction/preflight-reveal-queue-candidates.ts",
      ),
    ).href;
    const script = `
      import { createHook } from "node:async_hooks";
      import { processCandidates } from ${JSON.stringify(moduleUrl)};
      const activePromises = new Set();
      let peakPromises = 0;
      const hook = createHook({
        init(asyncId, type) {
          if (type !== "PROMISE") return;
          activePromises.add(asyncId);
          peakPromises = Math.max(peakPromises, activePromises.size);
        },
        promiseResolve(asyncId) {
          activePromises.delete(asyncId);
        },
      });
      const candidate = { action: { operation: "click" }, control: {} };
      const candidates = Array(${String(MAX_SURVEY_ACTIONS)}).fill(candidate);
      const current = {};
      const state = {
        queue: [],
        controls: [],
        discovered: new Map(),
        visitedStatePaths: new Map(),
        actionCount: 0,
        branchCount: 0,
        currentBranch: current,
        currentCandidates: candidates,
        currentCandidateIndex: 0,
      };
      let processed = 0;
      hook.enable();
      const result = await processCandidates(
        { queueInput: {}, state, current, candidates, index: 0 },
        ({ state: candidateState }) => {
          processed += 1;
          return Promise.resolve({ state: candidateState, executed: false });
        },
      );
      const restoredBranch = {};
      const restoredFlags = [];
      await processCandidates(
        {
          queueInput: {},
          state: { ...state, currentCandidates: [candidate, candidate] },
          current,
          candidates: [candidate, candidate],
          index: 0,
          restoredBranch,
        },
        ({ state: candidateState, restoredBranch: restored }) => {
          restoredFlags.push(restored === restoredBranch);
          return Promise.resolve({
            state: candidateState,
            executed: true,
            terminal: {},
          });
        },
      );
      hook.disable();
      process.stdout.write(JSON.stringify({
        processed,
        peakPromises,
        restoredFlags,
        yielded: result.yielded !== undefined,
        hasCursor: result.state.currentBranch !== undefined,
      }));
    `;
    const child = spawn(
      process.execPath,
      [
        "--max-old-space-size=128",
        "--import",
        "tsx/esm",
        "--input-type=module",
        "-e",
        script,
      ],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (value: Buffer) => {
      stdout += value.toString("utf8");
    });
    child.stderr.on("data", (value: Buffer) => {
      stderr += value.toString("utf8");
    });
    const exitCode = await waitForChildClose(child, CHILD_CLOSE_TIMEOUT_MS);

    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout) as Readonly<{
      processed: number;
      peakPromises: number;
      restoredFlags: readonly boolean[];
      yielded: boolean;
      hasCursor: boolean;
    }>;
    expect(result).toMatchObject({
      processed: MAX_SURVEY_ACTIONS,
      restoredFlags: [true, false],
      yielded: false,
      hasCursor: false,
    });
    expect(result.peakPromises).toBeLessThanOrEqual(16);
  });
});
