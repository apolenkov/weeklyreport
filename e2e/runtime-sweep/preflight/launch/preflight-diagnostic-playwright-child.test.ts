import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { createNestedProcessOwnershipFixture } from "./bounded/preflight-nested-process-ownership.test-support.ts";
import {
  buildPreflightDiagnosticPlaywrightArguments,
  diagnosticTimeoutFromEnvironment,
  diagnosticTraceModeFromEnvironment,
  runPreflightDiagnosticPlaywrightChild,
  spawnPreflightDiagnosticPlaywrightChild,
} from "./preflight-diagnostic-playwright-child.ts";

const BASE_ARGUMENTS = [
  "--filter",
  "@customreport/web",
  "exec",
  "playwright",
  "test",
  "--config",
  "../../e2e/runtime-sweep/preflight/playwright.diagnostic.config.ts",
] as const;

const readWhenPresent = async (filePath: string): Promise<string> => {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    try {
      return await readFile(filePath, "utf8");
    } catch (error: unknown) {
      if (!(
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ))
        throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Diagnostic command did not publish its environment");
};

const terminateReadyLauncher = async (root: string): Promise<void> => {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const readyName = (await readdir(root)).find((entry) =>
      entry.endsWith(".ready"),
    );
    if (readyName !== undefined) {
      const ready = JSON.parse(
        await readFile(path.join(root, readyName), "utf8"),
      ) as { readonly pgid: number };
      process.kill(-ready.pgid, "SIGTERM");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Owned diagnostic launcher did not publish READY");
};

describe("diagnostic Playwright child trace boundary", () => {
  it("keeps the default launch argv unchanged", () => {
    expect(diagnosticTraceModeFromEnvironment({})).toBe("retain-on-failure");
    expect(
      buildPreflightDiagnosticPlaywrightArguments("retain-on-failure"),
    ).toEqual(BASE_ARGUMENTS);
  });

  it("appends the exact trace-off override for the causal control", () => {
    expect(buildPreflightDiagnosticPlaywrightArguments("off")).toEqual([
      ...BASE_ARGUMENTS,
      "--trace",
      "off",
    ]);
    expect(
      diagnosticTraceModeFromEnvironment({
        RUNTIME_SWEEP_DIAGNOSTIC_TRACE_MODE: "off",
      }),
    ).toBe("off");
  });

  it("appends an explicit bounded timeout only when requested", () => {
    expect(
      buildPreflightDiagnosticPlaywrightArguments("retain-on-failure", 60_000),
    ).toEqual([...BASE_ARGUMENTS, "--timeout", "60000"]);
    expect(
      diagnosticTimeoutFromEnvironment({
        RUNTIME_SWEEP_DIAGNOSTIC_TIMEOUT_MS: "60000",
      }),
    ).toBe(60_000);
  });

  it("rejects unsupported trace modes before spawning a child", () => {
    expect(() =>
      diagnosticTraceModeFromEnvironment({
        RUNTIME_SWEEP_DIAGNOSTIC_TRACE_MODE: "on",
      }),
    ).toThrow(/retain-on-failure.*off/u);
  });

  it("rejects an invalid diagnostic timeout before spawning a child", () => {
    expect(() =>
      diagnosticTimeoutFromEnvironment({
        RUNTIME_SWEEP_DIAGNOSTIC_TIMEOUT_MS: "0",
      }),
    ).toThrow(/positive safe integer/u);
  });

  it("fails before spawning when nested ownership is not fully configured", async () => {
    await expect(
      spawnPreflightDiagnosticPlaywrightChild({
        repoRoot: process.cwd(),
        environment: {
          npm_execpath: "/not-started.mjs",
          RUNTIME_SWEEP_NESTED_OWNED_COMMAND_LAUNCHER: "/partial.mjs",
        },
      }),
    ).rejects.toThrow(/complete nested process ownership environment/u);
  });

  it("uses the same birth-bound handle for rollback and gone assertion", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "diagnostic-owned-child-"));
    const command = path.join(root, "diagnostic-command.mjs");
    const observedEnvironment = path.join(root, "observed-environment.json");
    await writeFile(
      command,
      [
        'import { writeFileSync } from "node:fs";',
        `writeFileSync(${JSON.stringify(observedEnvironment)}, JSON.stringify(Object.keys(process.env).filter((key) => key.startsWith("RUNTIME_SWEEP_NESTED_") || key.startsWith("CR001_OWNED_"))));`,
        "setInterval(() => undefined, 1000);",
      ].join("\n"),
      "utf8",
    );
    let launched:
      | Awaited<ReturnType<typeof spawnPreflightDiagnosticPlaywrightChild>>
      | undefined;
    try {
      const ownership = await createNestedProcessOwnershipFixture(root);
      launched = await spawnPreflightDiagnosticPlaywrightChild({
        repoRoot: process.cwd(),
        environment: { npm_execpath: command, ...ownership },
      });
      await expect(readWhenPresent(observedEnvironment)).resolves.toBe("[]");
      launched.signal("SIGTERM");
      await expect(launched.completion).rejects.toThrow(/SIGTERM/u);
      await launched.close();
      launched = undefined;
    } finally {
      if (launched !== undefined) {
        launched.signal("SIGKILL");
        await launched.close().catch(() => undefined);
      }
      await rm(root, { force: true, recursive: true });
    }
  });

  it("preserves the child failure when caller cleanup also fails", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "diagnostic-primary-"));
    const command = path.join(root, "diagnostic-command.mjs");
    await writeFile(command, "setInterval(() => undefined, 1000);", "utf8");
    try {
      const ownership = await createNestedProcessOwnershipFixture(root, {
        failGone: true,
      });
      const running = runPreflightDiagnosticPlaywrightChild({
        repoRoot: process.cwd(),
        environment: { npm_execpath: command, ...ownership },
      });
      await terminateReadyLauncher(root);
      const failure = await running.catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(AggregateError);
      expect(
        (failure as AggregateError).errors.some(
          (error) =>
            error instanceof Error &&
            /terminated by signal SIGTERM/iu.test(error.message),
        ),
      ).toBe(true);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
