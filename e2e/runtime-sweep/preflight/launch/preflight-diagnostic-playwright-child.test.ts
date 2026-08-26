import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildPreflightDiagnosticPlaywrightArguments,
  diagnosticTimeoutFromEnvironment,
  diagnosticTraceModeFromEnvironment,
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

  it("preserves a spawn setup failure", async () => {
    await expect(
      spawnPreflightDiagnosticPlaywrightChild({
        repoRoot: process.cwd(),
        environment: {
          npm_execpath: path.join(tmpdir(), "missing-pnpm-executable"),
        },
      }),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("owns one detached process group and strips legacy ownership variables", async () => {
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
      launched = await spawnPreflightDiagnosticPlaywrightChild({
        repoRoot: process.cwd(),
        environment: {
          npm_execpath: command,
          RUNTIME_SWEEP_NESTED_OBSOLETE: "remove",
          CR001_OWNED_OBSOLETE: "remove",
        },
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

  it("reports a signalled child and leaves no owned group", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "diagnostic-primary-"));
    const command = path.join(root, "diagnostic-command.mjs");
    await writeFile(command, "setInterval(() => undefined, 1000);", "utf8");
    try {
      const launched = await spawnPreflightDiagnosticPlaywrightChild({
        repoRoot: process.cwd(),
        environment: { npm_execpath: command },
      });
      launched.signal("SIGTERM");
      await expect(launched.completion).rejects.toThrow(/SIGTERM/iu);
      await expect(launched.close()).resolves.toBeUndefined();
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
