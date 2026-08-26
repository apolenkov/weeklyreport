import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createNestedProcessOwnershipFixture } from "./bounded/preflight-nested-process-ownership.test-support.ts";
import {
  capacitySurveyPlaywrightArgs,
  runPreflightCapacitySurveyChild,
} from "./preflight-capacity-survey-child.ts";

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

const executableFor = async (body: string): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "capacity-survey-child-"));
  temporaryRoots.push(root);
  const filePath = path.join(root, "launcher.mjs");
  await writeFile(filePath, body, "utf8");
  return filePath;
};

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("capacity survey browser child", () => {
  it("uses only the dedicated Playwright config", () => {
    expect(capacitySurveyPlaywrightArgs(["pnpm.cjs"])).toEqual([
      "pnpm.cjs",
      "--filter",
      "@customreport/web",
      "exec",
      "playwright",
      "test",
      "--config",
      "../../e2e/runtime-sweep/preflight/playwright.capacity-survey.config.ts",
    ]);
  });

  it("accepts a zero exit and rejects a nonzero exit", async () => {
    const success = await executableFor("process.exit(0);\n");
    const successOwnership = await createNestedProcessOwnershipFixture(
      path.dirname(success),
    );
    await expect(
      runPreflightCapacitySurveyChild({
        repoRoot: process.cwd(),
        environment: { npm_execpath: success, ...successOwnership },
        maxDurationMs: 5000,
      }),
    ).resolves.toBeUndefined();

    const failure = await executableFor("process.exit(7);\n");
    const failureOwnership = await createNestedProcessOwnershipFixture(
      path.dirname(failure),
    );
    await expect(
      runPreflightCapacitySurveyChild({
        repoRoot: process.cwd(),
        environment: { npm_execpath: failure, ...failureOwnership },
        maxDurationMs: 5000,
      }),
    ).rejects.toThrow(/exited code=7/iu);
  });

  it("terminates the detached process group at the hard deadline", async () => {
    const stalled = await executableFor(
      "setInterval(() => undefined, 1000);\n",
    );
    const ownership = await createNestedProcessOwnershipFixture(
      path.dirname(stalled),
    );
    await expect(
      runPreflightCapacitySurveyChild({
        repoRoot: process.cwd(),
        environment: { npm_execpath: stalled, ...ownership },
        maxDurationMs: 25,
        terminationGraceMs: 25,
      }),
    ).rejects.toThrow(/exceeded maxDurationMs=25/iu);
  });

  it("keeps SIGKILL escalation armed after the group leader exits", async () => {
    const leader = await executableFor("// replaced below\n");
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
    const ownership = await createNestedProcessOwnershipFixture(
      path.dirname(leader),
    );

    await expect(
      runPreflightCapacitySurveyChild({
        repoRoot: process.cwd(),
        environment: { npm_execpath: leader, ...ownership },
        maxDurationMs: 250,
        terminationGraceMs: 50,
      }),
    ).rejects.toThrow(/exceeded maxDurationMs=250/iu);

    const descendantPid = Number(await readFile(descendantPidPath, "utf8"));
    expect(Number.isSafeInteger(descendantPid)).toBe(true);
    await waitForProcessExit(descendantPid);
  });
});
