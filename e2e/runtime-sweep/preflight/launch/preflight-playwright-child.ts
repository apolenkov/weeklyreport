import { spawn } from "node:child_process";

import { runBoundedPlaywrightChild } from "./bounded/preflight-bounded-playwright-child.ts";
import type { ObservePreflightPlaywrightChildCleanup } from "./preflight-playwright-child-cleanup.ts";

const requiredEnv = (environment: NodeJS.ProcessEnv, name: string): string => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Runtime preflight launcher requires ${name}`);
  return value;
};

const pnpmLauncher = (
  environment: NodeJS.ProcessEnv,
): Readonly<{
  readonly command: string;
  readonly leadingArgs: readonly string[];
}> => {
  const executable = requiredEnv(environment, "npm_execpath");
  return /\.[cm]?js$/u.test(executable)
    ? { command: process.execPath, leadingArgs: [executable] }
    : { command: executable, leadingArgs: [] };
};

export const runPreflightPlaywrightChild = (input: {
  readonly repoRoot: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly bounds?: Readonly<{
    readonly maxDurationMs: number;
    readonly terminationGraceMs: number;
    readonly signal?: AbortSignal;
    readonly onCleanup?: ObservePreflightPlaywrightChildCleanup;
  }>;
}): Promise<number> => {
  if (input.bounds !== undefined)
    return runBoundedPlaywrightChild({
      operationName: "Reveal continuation",
      configPath:
        "../../e2e/runtime-sweep/preflight/playwright.preflight.config.ts",
      repoRoot: input.repoRoot,
      environment: input.environment,
      maxDurationMs: input.bounds.maxDurationMs,
      terminationGraceMs: input.bounds.terminationGraceMs,
      ...(input.bounds.signal === undefined
        ? {}
        : { signal: input.bounds.signal }),
      ...(input.bounds.onCleanup === undefined
        ? {}
        : { onCleanup: input.bounds.onCleanup }),
      acceptNonzeroExit: true,
    });
  const launcher = pnpmLauncher(input.environment);
  const child = spawn(
    launcher.command,
    [
      ...launcher.leadingArgs,
      "--filter",
      "@customreport/web",
      "exec",
      "playwright",
      "test",
      "--config",
      "../../e2e/runtime-sweep/preflight/playwright.preflight.config.ts",
    ],
    {
      cwd: input.repoRoot,
      env: input.environment,
      stdio: "inherit",
    },
  );
  return new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`Runtime preflight terminated by signal ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
};
