import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { createNestedProcessOwnershipFixture } from "./bounded/preflight-nested-process-ownership.test-support.ts";
import { runPreflightPlaywrightChild } from "./preflight-playwright-child.ts";

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

describe("bounded reveal continuation Playwright child", () => {
  it("kills the detached process group at the hard wall", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "reveal-child-wall-"));
    const launcher = path.join(root, "launcher.mjs");
    const descendantPidPath = path.join(root, "descendant.pid");
    const descendantBody =
      "process.on('SIGINT', () => undefined); setInterval(() => undefined, 1000);";
    await writeFile(
      launcher,
      [
        'import { spawn } from "node:child_process";',
        'import { writeFileSync } from "node:fs";',
        `const child = spawn(process.execPath, ["-e", ${JSON.stringify(descendantBody)}], { stdio: "ignore" });`,
        `writeFileSync(${JSON.stringify(descendantPidPath)}, String(child.pid));`,
        'process.on("SIGINT", () => process.exit(0));',
        "setInterval(() => undefined, 1000);",
      ].join("\n"),
      "utf8",
    );
    try {
      const ownership = await createNestedProcessOwnershipFixture(root);
      await expect(
        runPreflightPlaywrightChild({
          repoRoot: process.cwd(),
          environment: { npm_execpath: launcher, ...ownership },
          bounds: { maxDurationMs: 250, terminationGraceMs: 50 },
        }),
      ).rejects.toThrow(/exceeded maxDurationMs=250/iu);
      const descendantPid = Number(await readFile(descendantPidPath, "utf8"));
      expect(Number.isSafeInteger(descendantPid)).toBe(true);
      await waitForProcessExit(descendantPid);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("preserves the timeout when caller cleanup also fails", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "reveal-child-primary-"));
    const launcher = path.join(root, "launcher.mjs");
    await writeFile(launcher, "setInterval(() => undefined, 1000);", "utf8");
    try {
      const ownership = await createNestedProcessOwnershipFixture(root, {
        failGone: true,
      });
      const failure = await runPreflightPlaywrightChild({
        repoRoot: process.cwd(),
        environment: { npm_execpath: launcher, ...ownership },
        bounds: { maxDurationMs: 100, terminationGraceMs: 50 },
      }).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(AggregateError);
      expect(
        (failure as AggregateError).errors.some(
          (error) =>
            error instanceof Error &&
            /exceeded maxDurationMs=100/iu.test(error.message),
        ),
      ).toBe(true);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
