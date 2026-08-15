import { type ChildProcess, spawn } from "node:child_process";

const STOP_GRACE_MS = 10_000;
const CONFIG_PATH =
  "../../e2e/runtime-sweep/preflight/playwright.capacity-survey.config.ts";

class PreflightCapacitySurveyChildError extends Error {
  override readonly name = "PreflightCapacitySurveyChildError";
}

const requiredExecutable = (environment: NodeJS.ProcessEnv): string => {
  const value = environment.npm_execpath?.trim();
  if (!value)
    throw new PreflightCapacitySurveyChildError(
      "Capacity survey launcher requires npm_execpath",
    );
  return value;
};

const launcherFor = (
  environment: NodeJS.ProcessEnv,
): Readonly<{ command: string; leadingArgs: readonly string[] }> => {
  const executable = requiredExecutable(environment);
  return /\.[cm]?js$/u.test(executable)
    ? { command: process.execPath, leadingArgs: [executable] }
    : { command: executable, leadingArgs: [] };
};

const signalProcessGroup = (
  child: ChildProcess,
  signal: NodeJS.Signals,
): void => {
  if (child.pid === undefined) {
    child.kill(signal);
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch (error: unknown) {
    const code =
      error instanceof Error && "code" in error ? String(error.code) : "";
    if (code !== "ESRCH") throw error;
  }
};

const assertDuration = (name: string, value: number): void => {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new PreflightCapacitySurveyChildError(
      `Capacity survey ${name} must be a positive safe integer`,
    );
};

export const capacitySurveyPlaywrightArgs = (
  leadingArgs: readonly string[],
): readonly string[] => [
  ...leadingArgs,
  "--filter",
  "@customreport/web",
  "exec",
  "playwright",
  "test",
  "--config",
  CONFIG_PATH,
];

const waitForCapacitySurveyChild = (
  child: ChildProcess,
  maxDurationMs: number,
  terminationGraceMs: number,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const timers: {
      timedOut: boolean;
      escalation: NodeJS.Timeout | undefined;
      terminationErrors: unknown[];
    } = { timedOut: false, escalation: undefined, terminationErrors: [] };
    const clearTimers = (): void => {
      clearTimeout(deadline);
      if (timers.escalation !== undefined) clearTimeout(timers.escalation);
    };
    const deadline = setTimeout(() => {
      timers.timedOut = true;
      try {
        signalProcessGroup(child, "SIGINT");
      } catch (error: unknown) {
        timers.terminationErrors.push(error);
      }
      timers.escalation = setTimeout(() => {
        try {
          signalProcessGroup(child, "SIGKILL");
        } catch (error: unknown) {
          timers.terminationErrors.push(error);
        }
        const timeoutError = new PreflightCapacitySurveyChildError(
          `Capacity survey exceeded maxDurationMs=${String(maxDurationMs)}`,
        );
        reject(
          timers.terminationErrors.length === 0
            ? timeoutError
            : new AggregateError(
                [timeoutError, ...timers.terminationErrors],
                "Capacity survey process-group termination failed",
              ),
        );
      }, terminationGraceMs);
    }, maxDurationMs);
    child.once("error", (error) => {
      if (timers.timedOut) {
        timers.terminationErrors.push(error);
        return;
      }
      clearTimers();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (timers.timedOut) return;
      clearTimers();
      if (code !== 0) {
        reject(
          new PreflightCapacitySurveyChildError(
            `Capacity survey child exited code=${String(code)} signal=${String(signal)}`,
          ),
        );
        return;
      }
      resolve();
    });
  });

export function runPreflightCapacitySurveyChild(input: {
  readonly repoRoot: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly maxDurationMs: number;
  readonly terminationGraceMs?: number;
}): Promise<void> {
  assertDuration("maxDurationMs", input.maxDurationMs);
  const terminationGraceMs = input.terminationGraceMs ?? STOP_GRACE_MS;
  assertDuration("terminationGraceMs", terminationGraceMs);
  const launcher = launcherFor(input.environment);
  const child = spawn(
    launcher.command,
    [...capacitySurveyPlaywrightArgs(launcher.leadingArgs)],
    {
      cwd: input.repoRoot,
      detached: true,
      env: input.environment,
      stdio: "inherit",
    },
  );
  return waitForCapacitySurveyChild(
    child,
    input.maxDurationMs,
    terminationGraceMs,
  );
}
