import { spawn } from "node:child_process";

const DIAGNOSTIC_TRACE_MODE_ENV = "RUNTIME_SWEEP_DIAGNOSTIC_TRACE_MODE";
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
): readonly string[] => [
  ...DIAGNOSTIC_PLAYWRIGHT_ARGUMENTS,
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

export const runPreflightDiagnosticPlaywrightChild = (input: {
  readonly repoRoot: string;
  readonly environment: NodeJS.ProcessEnv;
}): Promise<number> => {
  const launcher = pnpmLauncher();
  const traceMode = diagnosticTraceModeFromEnvironment(input.environment);
  const child = spawn(
    launcher.command,
    [
      ...launcher.leadingArgs,
      ...buildPreflightDiagnosticPlaywrightArguments(traceMode),
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
        reject(
          new Error(`Diagnostic preflight terminated by signal ${signal}`),
        );
        return;
      }
      resolve(code ?? 1);
    });
  });
};
