import { spawn } from "node:child_process";

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
      "../../e2e/runtime-sweep/preflight/playwright.diagnostic.config.ts",
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
