import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "vitest";

import { runtimeShutdownCompletionWriter } from "./runtime-shutdown-completion.js";

const completionValue = (filePath: string): string =>
  JSON.stringify({
    filePath,
    completion: {
      artifact: "RUNTIME_PROFILE_SHUTDOWN_COMPLETE",
      version: 1,
      sourceSha: "a".repeat(40),
      matrixDigest: "b".repeat(64),
      assignmentDigest: "c".repeat(64),
      runId: "0198a5c7-8a27-7ca1-821d-5dbb8e493604",
      laneId: "lane-01",
      profile: "minimal",
      serviceName:
        "customreport-api-runtime-0198a5c7-8a27-7ca1-821d-5dbb8e493604-lane-01-minimal",
      startedAt: "2026-08-07T00:00:00.000Z",
    },
  });

const requiredWriter = (filePath: string): (() => Promise<void>) => {
  const writer = runtimeShutdownCompletionWriter(completionValue(filePath));
  if (writer === undefined)
    throw new Error("Runtime shutdown completion writer is missing");
  return writer;
};

test("writes immutable API-authored completion after shutdown drains", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "customreport-shutdown-"));
  const filePath = path.join(root, "observability", "minimal-shutdown.json");
  try {
    const writer = requiredWriter(filePath);
    await writer();
    const completion = JSON.parse(await readFile(filePath, "utf8")) as Record<
      string,
      unknown
    >;

    expect(completion).toMatchObject({
      artifact: "RUNTIME_PROFILE_SHUTDOWN_COMPLETE",
      acknowledgement: "api-drains-complete",
      laneId: "lane-01",
      profile: "minimal",
      startedAt: "2026-08-07T00:00:00.000Z",
    });
    expect(completion.completedAt).toEqual(expect.any(String));
    await expect(writer()).rejects.toMatchObject({ code: "EEXIST" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("stays disabled without an explicit runtime sweep contract", () => {
  expect(runtimeShutdownCompletionWriter(undefined)).toBeUndefined();
});

test("rejects a relative completion target before shutdown starts", () => {
  expect(() =>
    runtimeShutdownCompletionWriter(
      completionValue("observability/minimal-shutdown.json"),
    ),
  ).toThrow();
});
