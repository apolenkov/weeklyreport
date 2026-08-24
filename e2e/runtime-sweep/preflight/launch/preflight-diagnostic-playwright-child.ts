import { type ChildProcess, spawn } from "node:child_process";

const DIAGNOSTIC_TRACE_MODE_ENV = "RUNTIME_SWEEP_DIAGNOSTIC_TRACE_MODE";
const DIAGNOSTIC_TIMEOUT_ENV = "RUNTIME_SWEEP_DIAGNOSTIC_TIMEOUT_MS";
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

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Diagnostic preflight launcher requires ${name}`);
  return value;
};

const pnpmLauncher = (): Readonly<{
  readonly command: string;
  readonly leadingArgs: readonly string[];
}> => {
  const executable = requiredEnv("npm_execpath");
  return /\.[cm]?js$/u.test(executable)
    ? { command: process.execPath, leadingArgs: [executable] }
    : { command: executable, leadingArgs: [] };
};

export type PreflightDiagnosticPlaywrightChild = Readonly<{
  readonly child: ChildProcess;
  readonly completion: Promise<number>;
}>;

export const spawnPreflightDiagnosticPlaywrightChild = (input: {
  readonly repoRoot: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly detached?: boolean;
}): PreflightDiagnosticPlaywrightChild => {
  const launcher = pnpmLauncher();
  const traceMode = diagnosticTraceModeFromEnvironment(input.environment);
  const timeoutMs = diagnosticTimeoutFromEnvironment(input.environment);
  const child = spawn(
    launcher.command,
    [
      ...launcher.leadingArgs,
      ...buildPreflightDiagnosticPlaywrightArguments(traceMode, timeoutMs),
    ],
    {
      cwd: input.repoRoot,
      env: input.environment,
      stdio: "inherit",
      detached: input.detached ?? false,
    },
  );
  const completion = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null) {
        reject(
          new Error(`Diagnostic preflight terminated by signal ${signal}`),
        );
        return;
      }
      resolve(code ?? 1);
    });
  });
  return { child, completion };
};

export const runPreflightDiagnosticPlaywrightChild = (input: {
  readonly repoRoot: string;
  readonly environment: NodeJS.ProcessEnv;
}): Promise<number> =>
  spawnPreflightDiagnosticPlaywrightChild(input).completion;
