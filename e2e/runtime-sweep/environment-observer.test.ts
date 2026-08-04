import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { OpenCodeDriverReport } from "./driver-results-contract.ts";
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

const report = (candidates: OpenCodeDriverReport["candidates"] = []) =>
  ({
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
  }) satisfies OpenCodeDriverReport;

const candidate = (
  kind: OpenCodeDriverReport["candidates"][number]["kind"],
  candidateId: string,
  cellId: string,
): OpenCodeDriverReport["candidates"][number] => ({
  candidateId,
  cellId,
  kind,
  summary: `${kind} signal`,
  evidenceRefs: [`${candidateId}-evidence`],
});

const probeResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });
const observedTranscripts = [
  JSON.stringify({ tool_name: "browser_console_messages" }),
  JSON.stringify({ tool_name: "browser_network_requests" }),
];

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
          msg: "server warning",
        }),
        JSON.stringify({
          timestamp: "2026-08-04T09:00:00.000Z",
          level: "error",
          msg: "outside window",
        }),
      ].join("\n"),
    );
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes("example.test"))
        return Promise.resolve(probeResponse({ ok: true }));
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
      transcripts: observedTranscripts,
      apiLogPath,
      bugsinkDsn: "http://public@example.test/1",
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
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const bugsinkRequest = fetchMock.mock.calls.find(([input]) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      return url.includes("example.test");
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

  it("keeps unconfigured and unreadable channels blind", async () => {
    const feedback = await observeEnvironmentFeedback({
      report: report(),
      transcripts: observedTranscripts,
      apiLogPath: path.join(os.tmpdir(), "missing-runtime-observer.log"),
    });

    expect(feedback.blindChannels).toEqual(["app-log", "bugsink", "loki"]);
    expect(feedback.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "browser-console", status: "live" }),
        expect.objectContaining({ channel: "network", status: "live" }),
      ]),
    );
    expect(feedback.clean).toBe(false);
  });

  it("does not let the console canary certify unobserved browser channels", async () => {
    const feedback = await observeEnvironmentFeedback({
      report: report(),
      transcripts: [],
    });

    expect(feedback.blindChannels).toEqual([
      "browser-console",
      "network",
      "app-log",
      "bugsink",
      "loki",
    ]);
  });

  it("marks failed probes blind without exposing their credentials", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    const feedback = await observeEnvironmentFeedback({
      report: report(),
      transcripts: observedTranscripts,
      bugsinkDsn: "http://private:password@example.test/1",
      loki: {
        pushUrl: "http://loki.test/push",
        queryUrl: "http://loki.test/query",
        username: "user",
        password: "password",
      },
    });

    expect(feedback.blindChannels).toEqual(["app-log", "bugsink", "loki"]);
    expect(JSON.stringify(feedback)).not.toContain("password");
  });
});
