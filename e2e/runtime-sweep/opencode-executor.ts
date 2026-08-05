import { execFile } from "node:child_process";

const MAX_OUTPUT_BYTES = Number("16777216");
const OPENCODE_BINARY = "/opt/homebrew/bin/opencode";
const OPENCODE_INVOCATION_TIMEOUT_MINUTES = Number("15");
const MILLISECONDS_PER_MINUTE = Number("60000");

export const OPENCODE_INVOCATION_TIMEOUT_MS =
  OPENCODE_INVOCATION_TIMEOUT_MINUTES * MILLISECONDS_PER_MINUTE;

export type OpenCodeExecutor = (
  args: readonly string[],
) => Promise<{ readonly stdout: string }>;

interface TimedOutOpenCodeProcessError extends Error {
  readonly code: "ABORT_ERR";
  readonly cause: { readonly name: "TimeoutError" };
  readonly stdout?: string;
}

export class OpenCodeExecutorTimeoutError extends Error {
  override readonly name = "OpenCodeExecutorTimeoutError";

  constructor(readonly stdout: string) {
    super("OpenCode executor timed out");
  }
}

export type OpenCodeExecFile = (
  file: string,
  args: readonly string[],
  options: {
    readonly encoding: "utf8";
    readonly maxBuffer: number;
    readonly signal: AbortSignal;
  },
  callback: (error: unknown, stdout: string) => void,
) => { readonly stdin?: { end(): void } | null };

export type OpenCodeTimeoutSignal = (timeoutMs: number) => AbortSignal;

const productionExecFile: OpenCodeExecFile = (file, args, options, callback) =>
  execFile(file, args, options, (error, stdout) => callback(error, stdout));
const productionTimeoutSignal: OpenCodeTimeoutSignal = (timeoutMs) =>
  AbortSignal.timeout(timeoutMs);

export const isTimedOutOpenCodeProcessError = (
  error: unknown,
): error is TimedOutOpenCodeProcessError =>
  error instanceof Error &&
  error.name === "AbortError" &&
  "code" in error &&
  error.code === "ABORT_ERR" &&
  "cause" in error &&
  typeof error.cause === "object" &&
  error.cause !== null &&
  "name" in error.cause &&
  error.cause.name === "TimeoutError";

export const createOpenCodeExecutor =
  (
    run: OpenCodeExecFile = productionExecFile,
    timeoutSignal: OpenCodeTimeoutSignal = productionTimeoutSignal,
  ): OpenCodeExecutor =>
  async (args: readonly string[]): Promise<{ readonly stdout: string }> =>
    new Promise((resolve, reject) => {
      const child = run(
        OPENCODE_BINARY,
        [...args],
        {
          encoding: "utf8",
          maxBuffer: MAX_OUTPUT_BYTES,
          signal: timeoutSignal(OPENCODE_INVOCATION_TIMEOUT_MS),
        },
        (error, stdout) => {
          if (error) {
            reject(
              isTimedOutOpenCodeProcessError(error)
                ? new OpenCodeExecutorTimeoutError(stdout)
                : error,
            );
            return;
          }
          resolve({ stdout });
        },
      );
      child.stdin?.end();
    });
