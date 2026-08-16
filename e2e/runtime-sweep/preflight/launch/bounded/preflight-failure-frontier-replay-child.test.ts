import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  failureFrontierReplayPlaywrightArgs,
  runPreflightFailureFrontierReplayChild,
} from "./preflight-failure-frontier-replay-child.ts";

const temporaryRoots: string[] = [];

const processExists = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH")
      return false;
    throw error;
  }
};

const waitForProcessExit = async (pid: number): Promise<void> => {
  const deadline = Date.now() + 2000;
  while (processExists(pid) && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 20));
  if (processExists(pid))
    throw new Error(`Descendant process survived: ${pid}`);
};

const executableFor = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "frontier-replay-child-"));
  temporaryRoots.push(root);
  const filePath = path.join(root, "launcher.mjs");
  await writeFile(filePath, "", "utf8");
  return filePath;
};

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("failure-frontier replay browser child", () => {
  it("uses only the dedicated Playwright config", () => {
    expect(failureFrontierReplayPlaywrightArgs(["pnpm.cjs"])).toEqual([
      "pnpm.cjs",
      "--filter",
      "@customreport/web",
      "exec",
      "playwright",
      "test",
      "--config",
      "../../e2e/runtime-sweep/preflight/playwright.failure-frontier-replay.config.ts",
    ]);
  });

  it("kills and reaps a stalled setup descendant at the hard deadline", async () => {
    const leader = await executableFor();
    const descendantPidPath = path.join(path.dirname(leader), "descendant.pid");
    const descendantBody =
      "process.on('SIGINT', () => undefined); setInterval(() => undefined, 1000);";
    await writeFile(
      leader,
      [
        'import { spawn } from "node:child_process";',
        'import { writeFileSync } from "node:fs";',
        `const descendant = spawn(process.execPath, ["-e", ${JSON.stringify(descendantBody)}], { stdio: "ignore" });`,
        `writeFileSync(${JSON.stringify(descendantPidPath)}, String(descendant.pid));`,
        'process.on("SIGINT", () => process.exit(0));',
        "setInterval(() => undefined, 1000);",
      ].join("\n"),
      "utf8",
    );

    await expect(
      runPreflightFailureFrontierReplayChild({
        repoRoot: process.cwd(),
        environment: { npm_execpath: leader },
        maxDurationMs: 250,
        terminationGraceMs: 50,
      }),
    ).rejects.toThrow(/exceeded maxDurationMs=250/iu);

    const descendantPid = Number(await readFile(descendantPidPath, "utf8"));
    expect(Number.isSafeInteger(descendantPid)).toBe(true);
    await waitForProcessExit(descendantPid);
  });
});
