import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiDriverReport } from "../driver/driver-results-contract.ts";
import type { TranscriptToolRecord } from "../driver/driver-results-transcript.ts";
import { observeEnvironmentFeedback } from "./environment-observer.ts";

const SOURCE_SHA = "a".repeat(40);
const timeline = {
  startedAt: "2026-08-04T10:00:00.000Z",
  endedAt: "2026-08-04T10:05:00.000Z",
  routes: [
    {
      route: "/lead/report",
      enteredAt: "2026-08-04T10:00:00.000Z",
      leftAt: "2026-08-04T10:02:00.000Z",
    },
    {
      route: "/lead/history",
      enteredAt: "2026-08-04T10:02:00.000Z",
      leftAt: "2026-08-04T10:05:00.000Z",
    },
  ],
} as const;

const report = (candidates: AiDriverReport["candidates"] = []) =>
  ({
    provider: "native-codex",
    model: "gpt-5.6-luna",
    reasoning: "max",
    attemptId: "attempt-1",
    transcriptEvidence: {
      status: "captured",
      evidenceRefs: ["transcript:attempt-1"],
      digest: "a".repeat(64),
    },
    roleDriven: "lead",
    profile: "minimal",
    sourceSha: SOURCE_SHA,
    assignedCells: [
      {
        cellId: "cell-report",
        catalogRoute: "/lead/report",
        resolvedRoute: "/lead/report",
        actionKey: "save",
      },
      {
        cellId: "cell-history",
        catalogRoute: "/lead/history",
        resolvedRoute: "/lead/history",
        actionKey: "history",
      },
    ],
    routesVisited: 2,
    routesPlanned: 2,
    canary: { injected: true, detected: true },
    timeline,
    controlResults: [
      {
        cellId: "cell-report",
        controlKey: "save",
        status: "covered",
        result: "pass",
        evidenceRefs: ["save-evidence"],
      },
      {
        cellId: "cell-history",
        controlKey: "history",
        status: "covered",
        result: "pass",
        evidenceRefs: ["history-evidence"],
      },
    ],
    candidates,
  }) satisfies AiDriverReport;

const candidate = (
  kind: AiDriverReport["candidates"][number]["kind"],
  candidateId: string,
  cellId: string,
): AiDriverReport["candidates"][number] => ({
  candidateId,
  cellId,
  kind,
  summary: `${kind} signal`,
  evidenceRefs: [`${candidateId}-evidence`],
});

const probeResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });
const observedTranscriptRecords = [
  {
    attemptId: "attempt-1",
    timestamp: "2026-08-04T10:00:01.000Z",
    tool: "browser_console_messages",
    route: "/lead/report",
  },
  {
    attemptId: "attempt-1",
    timestamp: "2026-08-04T10:02:01.000Z",
    tool: "browser_network_requests",
    route: "/lead/history",
  },
] satisfies readonly TranscriptToolRecord[];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runtime-sweep environment observer", () => {
  it("derives driver signals, parses the API log, and verifies probes", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-observer-"),
    );
    const apiLogPath = path.join(directory, "app.log");
    await writeFile(
      apiLogPath,
      [
        JSON.stringify({
          timestamp: "2026-08-04T10:03:00.000Z",
          level: "warn",
          message: "server warning",
          correlationId: "runtime-observer",
        }),
        JSON.stringify({
          timestamp: "2026-08-04T09:00:00.000Z",
          level: "error",
          message: "outside window",
          correlationId: "runtime-observer",
        }),
      ].join("\n"),
    );
    const bugsinkProjectResponses = [
      {
        slug: "runtime-sweep",
        digested_event_count: 0,
        stored_event_count: 0,
      },
      {
        slug: "runtime-sweep",
        digested_event_count: 1,
        stored_event_count: 1,
      },
    ].values();
    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const requestUrl = new URL(url);
      if (requestUrl.pathname.includes("/canonical/0/projects/")) {
        return Promise.resolve(
          probeResponse(
            bugsinkProjectResponses.next().value ?? {
              slug: "runtime-sweep",
              digested_event_count: 0,
              stored_event_count: 0,
            },
          ),
        );
      }
      if (requestUrl.pathname.endsWith("/store/")) {
        const body =
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as { event_id?: string })
            : {};
        return Promise.resolve(probeResponse({ id: body.event_id }));
      }
      if (url.includes("/push"))
        return Promise.resolve(new Response(null, { status: 204 }));
      const probeId = new URL(url).searchParams
        .get("query")
        ?.match(/"([^"]+)"/u)?.[1];
      return Promise.resolve(
        probeResponse({
          status: "success",
          data: {
            result: [
              {
                values: [
                  [
                    "1722765780000000000",
                    `runtime-sweep-probe ${probeId ?? ""}`,
                  ],
                ],
              },
            ],
          },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const feedback = await observeEnvironmentFeedback({
      report: report([
        candidate("console", "console-1", "cell-report"),
        candidate("page", "page-1", "cell-history"),
        candidate("network", "network-1", "cell-history"),
      ]),
      transcriptRecords: observedTranscriptRecords,
      apiLogPath,
      apiLogEvidenceRef: `api-log:/tmp/app.log#sha256=${"b".repeat(64)}`,
      bugsink: {
        dsn: "http://public@example.test/1",
        apiToken: "a".repeat(40),
      },
      loki: {
        pushUrl: "http://loki.test/loki/api/v1/push",
        queryUrl: "http://loki.test/loki/api/v1/query_range",
        username: "user",
        password: "secret",
      },
    });

    expect(feedback.clean).toBe(false);
    expect(feedback.blindChannels).toEqual([]);
    expect(feedback.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "browser-console", status: "live" }),
        expect.objectContaining({ channel: "network", status: "live" }),
        expect.objectContaining({ channel: "app-log", status: "live" }),
        expect.objectContaining({ channel: "bugsink", status: "live" }),
        expect.objectContaining({ channel: "loki", status: "live" }),
      ]),
    );
    expect(
      feedback.hits.map(({ kind, channel }) => ({ kind, channel })),
    ).toEqual(
      expect.arrayContaining([
        { kind: "console", channel: "browser-console" },
        { kind: "network", channel: "network" },
        { kind: "server", channel: "app-log" },
      ]),
    );
    expect(
      feedback.hits.find(({ channel }) => channel === "app-log")?.route,
    ).toBe("/lead/history");
    expect(
      feedback.hits.find(({ eventId }) => eventId === "driver-console-1"),
    ).toMatchObject({
      route: "/lead/report",
      timestamp: "2026-08-04T10:02:00.000Z",
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const bugsinkRequest = fetchMock.mock.calls.find(([input]) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      return new URL(url).pathname.endsWith("/store/");
    });
    const bugsinkUrl = bugsinkRequest?.[0];
    expect(
      typeof bugsinkUrl === "string"
        ? bugsinkUrl
        : bugsinkUrl instanceof URL
          ? bugsinkUrl.href
          : bugsinkUrl?.url,
    ).toBe("http://example.test/api/1/store/");
    expect(bugsinkRequest?.[1]?.headers).not.toMatchObject({
      password: "secret",
    });

    await rm(directory, { recursive: true, force: true });
  });
});
