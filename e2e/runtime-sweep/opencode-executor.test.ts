import { expect, test, vi } from "vitest";

import {
  createOpenCodeExecutor,
  OPENCODE_INVOCATION_TIMEOUT_MS,
  type OpenCodeExecFile,
  type OpenCodeTimeoutSignal,
} from "./opencode-executor.ts";
import {
  assertPlaywrightMcpConnected,
  OpenCodeDriveTimeoutError,
} from "./opencode-runner.ts";

class FakeTimeoutCause extends Error {
  override readonly name = "TimeoutError";
}

class FakeTimeoutError extends Error {
  override readonly name = "AbortError";
  readonly code = "ABORT_ERR" as const;
  override readonly cause = new FakeTimeoutCause();
}

class FakeExternalSigtermError extends Error {
  override readonly name = "Error";
  readonly killed = true as const;
  readonly signal = "SIGTERM" as const;
}

test("bounds the child invocation and preserves callback output on timeout", async () => {
  const run = vi
    .fn<OpenCodeExecFile>()
    .mockImplementation((_file, _args, _options, callback) => {
      callback(new FakeTimeoutError(), "callback partial output");
      return { stdin: { end: () => undefined } };
    });
  const timeoutSignal = vi
    .fn<OpenCodeTimeoutSignal>()
    .mockImplementation(() => new AbortController().signal);
  const execute = createOpenCodeExecutor(run, timeoutSignal);

  try {
    await assertPlaywrightMcpConnected(execute);
    throw new Error("expected a timeout");
  } catch (error) {
    expect(error).toBeInstanceOf(OpenCodeDriveTimeoutError);
    if (error instanceof OpenCodeDriveTimeoutError)
      expect(error.transcripts).toEqual(["callback partial output"]);
  }
  expect(timeoutSignal).toHaveBeenCalledWith(OPENCODE_INVOCATION_TIMEOUT_MS);
  expect(run.mock.calls[0]?.[2]?.signal).toBeInstanceOf(AbortSignal);
});

test("does not classify an externally terminated child as a timeout", async () => {
  const error = new FakeExternalSigtermError("Command terminated");
  const run = vi
    .fn<OpenCodeExecFile>()
    .mockImplementation((_file, _args, _options, callback) => {
      callback(error, "partial external termination");
      return { stdin: { end: () => undefined } };
    });
  const execute = createOpenCodeExecutor(run);

  await expect(assertPlaywrightMcpConnected(execute)).rejects.toBe(error);
  expect(run.mock.calls[0]?.[2]?.signal).toBeInstanceOf(AbortSignal);
});
