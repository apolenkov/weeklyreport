import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiDriverReport } from "../../driver/driver-results-contract.ts";
import type { TranscriptToolRecord } from "../../driver/driver-results-transcript.ts";
import { observeEnvironmentFeedback } from "./environment-observer.ts";

const SOURCE_SHA = "a".repeat(40);
const timeline = {
  startedAt: "2026-08-04T10:00:00.000Z",
  endedAt: "2026-08-04T10:05:00.000Z",
  routes: [
    {
      route: "/lead/report",
      enteredAt: "2026-08-04T10:00:00.000Z",
      leftAt: "2026-08-04T10:05:00.000Z",
    },
  ],
} as const;

const report = (): AiDriverReport => ({
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
  ],
  routesVisited: 1,
  routesPlanned: 1,
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
  ],
  candidates: [],
});

const transcriptRecords = [
  {
    attemptId: "attempt-1",
    timestamp: "2026-08-04T10:00:01.000Z",
    tool: "browser_console_messages",
    route: "/lead/report",
  },
  {
    attemptId: "attempt-1",
    timestamp: "2026-08-04T10:00:02.000Z",
    tool: "browser_network_requests",
    route: "/lead/report",
  },
] satisfies readonly TranscriptToolRecord[];

const evidenceRef = `api-log:test#sha256=${"a".repeat(64)}`;

afterEach(() => vi.unstubAllGlobals());

describe("runtime-sweep environment observer safety", () => {
  it("does not treat a timestamp-only JSON line as an app-log stream", async () => {
    const feedback = await observeEnvironmentFeedback({
      report: report(),
      transcriptRecords,
      apiLogText: `${JSON.stringify({
        timestamp: "2026-08-04T10:03:00.000Z",
      })}\n`,
      apiLogEvidenceRef: evidenceRef,
    });

    expect(feedback.channels).toContainEqual({
      channel: "app-log",
      reachable: true,
      hasStreams: false,
      status: "blind",
      reason: "no shipped stream",
    });
  });

  it("redacts bearer, cookie, URL, query, JWT, and JSON secrets", async () => {
    const secrets = [
      "bearer-secret",
      "session-secret",
      "refresh-secret",
      "url-password",
      "query-secret",
      "jwt-secret",
      "json secret with spaces, punctuation!",
      "dXNlcjpwYXNz",
      "proxy-user-secret",
      "caret^secret",
    ] as const;
    const messages = [
      `Authorization: Bearer ${secrets[0]}`,
      `Cookie: session=${secrets[1]}; refresh=${secrets[2]}`,
      `request failed at https://user:${secrets[3]}@example.test`,
      `request failed at https://example.test/?token=${secrets[4]}&next=ok`,
      `request failed with eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.${secrets[5]}`,
      `request failed: {"token":"${secrets[6]}","message":"diagnostic preserved"}`,
      `Authorization: Basic ${secrets[7]}`,
      `Proxy-Authorization: Custom ${secrets[8]}`,
      `request failed: token=${secrets[9]}`,
    ];
    const apiLogText = messages
      .map((message) =>
        JSON.stringify({
          timestamp: "2026-08-04T10:03:00.000Z",
          level: "error",
          message,
          correlationId: "runtime-observer",
        }),
      )
      .join("\n");
    const feedback = await observeEnvironmentFeedback({
      report: report(),
      transcriptRecords,
      apiLogText,
      apiLogEvidenceRef: evidenceRef,
    });
    const serialized = JSON.stringify(feedback);

    expect(feedback.hits).toHaveLength(messages.length);
    expect(serialized).toContain("diagnostic preserved");
    secrets.forEach((secret) => expect(serialized).not.toContain(secret));
  });

  it("keeps failed probes blind without exposing credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
    );

    const feedback = await observeEnvironmentFeedback({
      report: report(),
      transcriptRecords,
      bugsink: {
        dsn: "http://private:password@example.test/1",
        apiToken: "b".repeat(40),
      },
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
