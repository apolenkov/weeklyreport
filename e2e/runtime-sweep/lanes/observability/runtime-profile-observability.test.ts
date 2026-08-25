import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type {
  RuntimeLane,
  RuntimeLaneAssignment,
} from "../contracts/runtime-lane-contract.ts";
import type { RuntimeLaneRunIdentity } from "../profiles/runtime-lane-run-identity.ts";
import { reconcileRuntimeProfileObservability } from "./runtime-profile-observability.ts";

const SOURCE_SHA = "a".repeat(40);
const DIGEST = "b".repeat(64);
const RUN_ID = "00000000-0000-4000-8000-000000000001";
type LogLevel = "info" | "warn" | "error";

const laneFor = (archiveRoot: string): RuntimeLane => ({
  laneId: "a",
  databaseName: "customreport_e2e_lane_a_test",
  redisPort: 6381,
  apiPort: 3112,
  webPort: 3115,
  archiveRoot,
  groups: [{ profile: "minimal", caseIds: ["case-a"] }],
});

const logLineFor = (level: LogLevel): string =>
  JSON.stringify({
    timestamp: "2026-08-07T00:00:00.100Z",
    level,
    message: "trpc request end",
    correlationId: "corr-a",
    service: "customreport-api",
  });
const logLine = logLineFor("info");
const shutdownLine = JSON.stringify({
  timestamp: "2026-08-07T00:00:00.150Z",
  level: "info",
  message: "API shutdown log barrier reached",
  correlationId: "no-context",
  service: "customreport-api",
});

const config = {
  otelEndpoint: "http://127.0.0.1:4318/",
  bugsink: {
    dsn: "http://key@127.0.0.1:8000/1",
    apiToken: "a".repeat(40),
  },
  loki: {
    pushUrl: "http://127.0.0.1:3100/loki/api/v1/push",
    queryUrl: "http://127.0.0.1:3100/loki/api/v1/query_range",
  },
} as const;

const vectorResponse = (level: LogLevel = "info"): Response =>
  new Response(
    JSON.stringify({
      status: "success",
      data: {
        resultType: "vector",
        result: [
          {
            metric: { correlationId: "corr-a", level },
            value: [1, "1"],
          },
          {
            metric: { correlationId: "no-context", level: "info" },
            value: [1, "1"],
          },
        ],
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
const markerResponse = (count = 1): Response =>
  new Response(
    JSON.stringify({
      status: "success",
      data: {
        resultType: "vector",
        result: count === 0 ? [] : [{ metric: {}, value: [1, String(count)] }],
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );

const fetcherFor = (level: "info" | "warn" | "error" = "info") =>
  vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(vectorResponse(level))
    .mockResolvedValue(markerResponse());

const prepareLog = async (
  content: string,
): Promise<Readonly<{ root: string; lane: RuntimeLane }>> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "runtime-profile-otel-"));
  const logDirectory = path.join(root, "api-log", "minimal");
  await mkdir(logDirectory, { recursive: true });
  await writeFile(path.join(logDirectory, "app.log"), content, "utf8");
  return { root, lane: laneFor(root) };
};

const identityFor = (
  lane: RuntimeLane,
): Readonly<{
  assignment: RuntimeLaneAssignment;
  run: RuntimeLaneRunIdentity;
}> => ({
  assignment: {
    artifact: "RUNTIME_LANE_ASSIGNMENT",
    version: 1,
    sourceSha: SOURCE_SHA,
    matrixDigest: DIGEST,
    mode: "one-cell",
    sourceArchiveRoot: path.dirname(lane.archiveRoot),
    sourceArtifacts: {
      SOURCE: DIGEST,
      SOURCE_VALIDATION: DIGEST,
      PREFLIGHT: DIGEST,
      MATRIX: DIGEST,
      MANIFEST: DIGEST,
    },
    profiles: ["minimal"],
    lanes: [lane],
    assignmentDigest: DIGEST,
  },
  run: {
    artifact: "RUNTIME_LANE_RUN",
    version: 1,
    sourceSha: SOURCE_SHA,
    matrixDigest: DIGEST,
    assignmentDigest: DIGEST,
    runId: RUN_ID,
    startedAt: "2026-08-07T00:00:00.000Z",
    laneIds: ["a"],
    profiles: ["minimal"],
  },
});

const run = (lane: RuntimeLane, fetcher: typeof fetch): Promise<void> =>
  reconcileRuntimeProfileObservability({
    lane,
    profile: "minimal",
    ...identityFor(lane),
    startedAt: "2026-08-07T00:00:00.000Z",
    endedAt: "2026-08-07T00:00:00.200Z",
    observability: config,
    fetcher,
  });

describe("runtime profile observability", () => {
  it("proves exact app.log correlation counts arrived in Loki", async () => {
    const prepared = await prepareLog(`${logLine}\n${shutdownLine}\n`);
    const fetcher = fetcherFor();

    await expect(run(prepared.lane, fetcher)).resolves.toBeUndefined();

    const report = JSON.parse(
      await readFile(
        path.join(prepared.root, "observability", "minimal.json"),
        "utf8",
      ),
    ) as { status: string; issues: readonly string[] };
    expect(report).toEqual(
      expect.objectContaining({ status: "pass", issues: [] }),
    );
    const [request] = fetcher.mock.calls[0] ?? [];
    expect(request).toBeInstanceOf(URL);
    if (!(request instanceof URL)) throw new Error("Expected a Loki query URL");
    expect(request.href).toContain(
      `customreport-api-runtime-${RUN_ID}-a-minimal`,
    );
  });

  it("writes fail evidence for a malformed app.log line", async () => {
    const prepared = await prepareLog(
      `${logLine}\n${shutdownLine}\nnot-json\n`,
    );
    const fetcher = fetcherFor();

    await expect(run(prepared.lane, fetcher)).rejects.toThrow(/malformed/u);

    const report = JSON.parse(
      await readFile(
        path.join(prepared.root, "observability", "minimal.json"),
        "utf8",
      ),
    ) as { status: string };
    expect(report.status).toBe("fail");
  });

  it.each(["warn", "error"] as const)(
    "fails the profile policy for a correlated %s record",
    async (level) => {
      const prepared = await prepareLog(
        `${logLineFor(level)}\n${shutdownLine}\n`,
      );
      const fetcher = fetcherFor(level);

      await expect(run(prepared.lane, fetcher)).rejects.toThrow(
        new RegExp(level === "warn" ? "warning record" : "error record", "u"),
      );
    },
  );

  it("fails when Loki contains a duplicate shutdown barrier", async () => {
    const prepared = await prepareLog(`${logLine}\n${shutdownLine}\n`);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(vectorResponse())
      .mockResolvedValue(markerResponse(2));

    await expect(run(prepared.lane, fetcher)).rejects.toThrow(
      /Loki contains 2 shutdown barrier/u,
    );
  });
});
