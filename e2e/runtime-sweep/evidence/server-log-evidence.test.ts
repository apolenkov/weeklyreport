import { appendFile, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { ResponseRecord } from "./evidence-types.ts";
import { collectServerLogEvidence } from "./server-log-evidence.ts";

const response = (correlationId: string | null): ResponseRecord => ({
  url: "/trpc/report.get",
  method: "GET",
  resourceType: "fetch",
  status: 200,
  ok: true,
  startedAt: "2026-08-07T00:00:00.000Z",
  endedAt: "2026-08-07T00:00:00.100Z",
  durationMs: 100,
  correlationId,
});

const record = (
  timestamp: string,
  level: "info" | "warn",
  message: string,
  correlationId: string,
  service = "customreport-api",
): string =>
  JSON.stringify({ timestamp, level, message, correlationId, service });

describe("server log evidence", () => {
  it("correlates API and worker logs and surfaces slow warnings", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "runtime-log-"));
    const logPath = path.join(directory, "app.log");
    await writeFile(
      logPath,
      [
        record("2026-08-07T00:00:00.050Z", "info", "trpc request", "corr-a"),
        record(
          "2026-08-07T00:00:00.060Z",
          "info",
          "worker completed",
          "corr-a",
          "pdf-export-worker",
        ),
        record("2026-08-07T00:00:00.070Z", "warn", "slow query", "no-context"),
      ].join("\n"),
      "utf8",
    );

    const evidence = await collectServerLogEvidence({
      path: logPath,
      responses: [response("corr-a")],
      startedAt: "2026-08-07T00:00:00.000Z",
      endedAt: "2026-08-07T00:00:00.100Z",
    });

    expect(evidence).toMatchObject({
      available: true,
      malformedCount: 0,
      missingCorrelationIds: [],
      warningCount: 1,
      slowCount: 1,
      workerCount: 1,
    });
    expect(evidence.records).toHaveLength(3);
  });

  it("fails closed when the log file is unavailable", async () => {
    const evidence = await collectServerLogEvidence({
      path: "/missing/runtime/app.log",
      responses: [response("corr-a")],
      startedAt: "2026-08-07T00:00:00.000Z",
      endedAt: "2026-08-07T00:00:00.100Z",
    });

    expect(evidence).toMatchObject({
      available: false,
      malformedCount: 0,
      missingCorrelationIds: ["corr-a"],
    });
  });

  it("fails closed when the log contains no canonical record", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "runtime-log-"));
    const logPath = path.join(directory, "app.log");
    await writeFile(logPath, "not-json\n", "utf8");

    const evidence = await collectServerLogEvidence({
      path: logPath,
      responses: [],
      startedAt: "2026-08-07T00:00:00.000Z",
      endedAt: "2026-08-07T00:00:00.100Z",
    });

    expect(evidence).toMatchObject({
      available: false,
      malformedCount: 1,
    });
  });

  it("waits for a correlated log line queued after collection starts", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "runtime-log-"));
    const logPath = path.join(directory, "app.log");
    await writeFile(logPath, "", "utf8");
    const append = new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        void appendFile(
          logPath,
          `${record(
            "2026-08-07T00:00:00.050Z",
            "info",
            "trpc request",
            "corr-a",
          )}\n`,
          "utf8",
        ).then(resolve, reject);
      }, 50);
    });

    const evidence = await collectServerLogEvidence({
      path: logPath,
      responses: [response("corr-a")],
      startedAt: "2026-08-07T00:00:00.000Z",
      endedAt: "2026-08-07T00:00:00.100Z",
    });
    await append;

    expect(evidence).toMatchObject({
      available: true,
      missingCorrelationIds: [],
    });
  });
});
