import type { ChildProcess } from "node:child_process";

import { spawnDetachedProcessGroup } from "./bounded/preflight-detached-process-group.ts";

const DIAGNOSTIC_TRACE_MODE_ENV = "RUNTIME_SWEEP_DIAGNOSTIC_TRACE_MODE";
const DIAGNOSTIC_TIMEOUT_ENV = "RUNTIME_SWEEP_DIAGNOSTIC_TIMEOUT_MS";
const DIAGNOSTIC_OPERATION_NAME = "diagnostic-preflight-playwright";
const DIAGNOSTIC_PLAYWRIGHT_ARGUMENTS = [
  "--filter",
  "@customreport/web",
  "exec",
  "playwright",
  "test",
  "--config",
  "../../e2e/runtime-sweep/preflight/playwright.diagnostic.config.ts",
] as const;

export type DiagnosticTraceMode = "retain-on-failure" | "off";

export const diagnosticTimeoutFromEnvironment = (
  environment: NodeJS.ProcessEnv,
): number | undefined => {
  const value = environment[DIAGNOSTIC_TIMEOUT_ENV];
  if (value === undefined) return undefined;
  const timeout = Number(value);
  if (!Number.isSafeInteger(timeout) || timeout < 1)
    throw new Error(
      `${DIAGNOSTIC_TIMEOUT_ENV} must be a positive safe integer; received ${value}`,
    );
  return timeout;
};

class InvalidDiagnosticTraceModeError extends Error {
  override readonly name = "InvalidDiagnosticTraceModeError";

  constructor(readonly value: string) {
    super(
      `${DIAGNOSTIC_TRACE_MODE_ENV} must be retain-on-failure or off; received ${value}`,
    );
  }
}

export const diagnosticTraceModeFromEnvironment = (
  environment: NodeJS.ProcessEnv,
): DiagnosticTraceMode => {
  const value = environment[DIAGNOSTIC_TRACE_MODE_ENV];
  if (value === undefined) return "retain-on-failure";
  if (value === "retain-on-failure" || value === "off") return value;
  throw new InvalidDiagnosticTraceModeError(value);
};

export const buildPreflightDiagnosticPlaywrightArguments = (
  traceMode: DiagnosticTraceMode,
  timeoutMs?: number,
): readonly string[] => [
  ...DIAGNOSTIC_PLAYWRIGHT_ARGUMENTS,
  ...(timeoutMs === undefined ? [] : ["--timeout", String(timeoutMs)]),
  ...(traceMode === "off" ? ["--trace", "off"] : []),
];

const requiredEnv = (name: string, environment: NodeJS.ProcessEnv): string => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Diagnostic preflight launcher requires ${name}`);
  return value;
};

const pnpmLauncher = (
  environment: NodeJS.ProcessEnv,
): Readonly<{
  readonly command: string;
  readonly leadingArgs: readonly string[];
}> => {
  const executable = requiredEnv("npm_execpath", environment);
  return /\.[cm]?js$/u.test(executable)
    ? { command: process.execPath, leadingArgs: [executable] }
    : { command: executable, leadingArgs: [] };
};

export type PreflightDiagnosticPlaywrightChild = Readonly<{
  readonly child: ChildProcess;
  readonly completion: Promise<number>;
  readonly signal: (signal: NodeJS.Signals) => void;
  readonly close: () => Promise<void>;
  readonly abort: (primary: unknown) => Promise<never>;
}>;

const completionFor = (child: ChildProcess): Promise<number> =>
  new Promise<number>((resolve, reject) => {
    const state = { settled: false };
    const cleanup = (): void => {
      child.off("error", onError);
      child.off("exit", onExit);
    };
    const settle = (): void => {
      if (state.settled) return;
      if (child.signalCode !== null) {
        state.settled = true;
        cleanup();
        reject(
          new Error(
            `Diagnostic preflight terminated by signal ${child.signalCode}`,
          ),
        );
        return;
      }
      if (child.exitCode !== null) {
        state.settled = true;
        cleanup();
        resolve(child.exitCode);
      }
    };
    const onError = (error: Error): void => {
      if (state.settled) return;
      state.settled = true;
      cleanup();
      reject(error);
    };
    const onExit = (
      code: number | null,
      signal: NodeJS.Signals | null,
    ): void => {
      if (state.settled) return;
      state.settled = true;
      cleanup();
      if (signal !== null) {
        reject(
          new Error(`Diagnostic preflight terminated by signal ${signal}`),
        );
        return;
      }
      resolve(code ?? 1);
    };
    child.once("error", onError);
    child.once("exit", onExit);
    settle();
  });

export const spawnPreflightDiagnosticPlaywrightChild = async (input: {
  readonly repoRoot: string;
  readonly environment: NodeJS.ProcessEnv;
}): Promise<PreflightDiagnosticPlaywrightChild> => {
  const launcher = pnpmLauncher(input.environment);
  const traceMode = diagnosticTraceModeFromEnvironment(input.environment);
  const timeoutMs = diagnosticTimeoutFromEnvironment(input.environment);
  const owned = await spawnDetachedProcessGroup({
    operationName: DIAGNOSTIC_OPERATION_NAME,
    command: launcher.command,
    args: [
      ...launcher.leadingArgs,
      ...buildPreflightDiagnosticPlaywrightArguments(traceMode, timeoutMs),
    ],
    repoRoot: input.repoRoot,
    environment: input.environment,
  });
  return { ...owned, completion: completionFor(owned.child) };
};

export const runPreflightDiagnosticPlaywrightChild = async (input: {
  readonly repoRoot: string;
  readonly environment: NodeJS.ProcessEnv;
}): Promise<number> => {
  const owned = await spawnPreflightDiagnosticPlaywrightChild(input);
  try {
    const exitCode = await owned.completion;
    await owned.close();
    return exitCode;
  } catch (error: unknown) {
    return owned.abort(error);
  }
};
