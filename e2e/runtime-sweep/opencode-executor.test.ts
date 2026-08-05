import { expect, test, vi } from "vitest";

import {
  createOpenCodeExecutor,
  OPENCODE_INVOCATION_TIMEOUT_MS,
  type OpenCodeExecFile,
} from "./opencode-executor.ts";
import { assertPlaywrightMcpConnected } from "./opencode-runner.ts";

class FakeTimeoutError extends Error {
  override readonly name = "FakeTimeoutError";
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
  const execute = createOpenCodeExecutor(run);

  await expect(assertPlaywrightMcpConnected(execute)).rejects.toMatchObject({
    name: "OpenCodeDriveTimeoutError",
    transcripts: ["callback partial output"],
  });
  expect(run.mock.calls[0]?.[2]).toMatchObject({
    timeout: OPENCODE_INVOCATION_TIMEOUT_MS,
    killSignal: "SIGTERM",
  });
});
