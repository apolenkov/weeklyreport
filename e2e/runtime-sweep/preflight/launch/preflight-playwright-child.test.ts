import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

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

const failureMessages = (error: unknown): readonly string[] =>
  error instanceof AggregateError
    ? [error.message, ...error.errors.flatMap(failureMessages)]
    : [error instanceof Error ? error.message : String(error)];

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
        'process.on("SIGINT", () => undefined);',
        "setInterval(() => undefined, 1000);",
      ].join("\n"),
      "utf8",
    );
    try {
      await expect(
        runPreflightPlaywrightChild({
          repoRoot: process.cwd(),
          environment: { npm_execpath: launcher },
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

  it("does not forward legacy ownership variables", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "reveal-child-env-"));
    const launcher = path.join(root, "launcher.mjs");
    const observedEnvironment = path.join(root, "environment.json");
    await writeFile(
      launcher,
      [
        'import { writeFileSync } from "node:fs";',
        `writeFileSync(${JSON.stringify(observedEnvironment)}, JSON.stringify(Object.keys(process.env).filter((key) => key.startsWith("RUNTIME_SWEEP_NESTED_") || key.startsWith("CR001_OWNED_"))));`,
      ].join("\n"),
      "utf8",
    );
    try {
      await expect(
        runPreflightPlaywrightChild({
          repoRoot: process.cwd(),
          environment: {
            npm_execpath: launcher,
            RUNTIME_SWEEP_NESTED_OBSOLETE: "remove",
            CR001_OWNED_OBSOLETE: "remove",
          },
          bounds: { maxDurationMs: 1000, terminationGraceMs: 50 },
        }),
      ).resolves.toBe(0);
      await expect(readFile(observedEnvironment, "utf8")).resolves.toBe("[]");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("reports residue without signalling after the group leader exits", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "reveal-child-residue-"));
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
    let descendantPid: number | undefined;
    try {
      const failure = await runPreflightPlaywrightChild({
        repoRoot: process.cwd(),
        environment: { npm_execpath: launcher },
        bounds: { maxDurationMs: 500, terminationGraceMs: 50 },
      }).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(AggregateError);
      const messages = failureMessages(failure);
      expect(
        messages.some((message) =>
          /exceeded maxDurationMs=500/iu.test(message),
        ),
      ).toBe(true);
      expect(
        messages.some((message) =>
          /leader exited with live process-group descendants/iu.test(message),
        ),
      ).toBe(true);
      descendantPid = Number(await readFile(descendantPidPath, "utf8"));
      expect(Number.isSafeInteger(descendantPid)).toBe(true);
      expect(processExists(descendantPid)).toBe(true);
    } finally {
      if (descendantPid !== undefined && processExists(descendantPid))
        process.kill(descendantPid, "SIGKILL");
      if (descendantPid !== undefined) await waitForProcessExit(descendantPid);
      await rm(root, { force: true, recursive: true });
    }
  });
});
