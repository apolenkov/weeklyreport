import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import { OPENCODE_INVOCATION_TIMEOUT_MS } from "./opencode-executor.ts";
import { OpenCodeDriveTimeoutError } from "./opencode-runner.ts";
import { persistOpenCodeDriveInterruption } from "./run-opencode-shard.ts";

test("archives a timed-out OpenCode drive as interrupted failure evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "runtime-driver-timeout-"));
  try {
    const timeout = new OpenCodeDriveTimeoutError(
      "session-timeout",
      ["partial transcript"],
      OPENCODE_INVOCATION_TIMEOUT_MS,
    );
    const artifacts = await persistOpenCodeDriveInterruption(
      directory,
      timeout,
    );

    await expect(readFile(artifacts.reportPath, "utf8")).resolves.toBe("");
    const sessionText = await readFile(artifacts.sessionPath, "utf8");
    const session: unknown = JSON.parse(sessionText);
    expect(session).toMatchObject({
      status: "interrupted",
      sessionId: "session-timeout",
      transcripts: ["partial transcript"],
      failure: {
        kind: "timeout",
        message: timeout.message,
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
