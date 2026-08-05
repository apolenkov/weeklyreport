import { describe, expect, it } from "vitest";

import {
  correlateEnvironmentFeedback,
  type EnvironmentFeedbackDocument,
} from "./environment-feedback.ts";

const timeline = {
  startedAt: "2026-08-04T10:00:00.000Z",
  endedAt: "2026-08-04T10:05:00.000Z",
  routes: [
    {
      route: "/lead/report",
      enteredAt: "2026-08-04T10:01:00.000Z",
      leftAt: "2026-08-04T10:02:00.000Z",
    },
    {
      route: "/lead/history",
      enteredAt: "2026-08-04T10:03:00.000Z",
      leftAt: "2026-08-04T10:04:00.000Z",
    },
  ],
};

const liveChannels = () => [
  {
    channel: "browser-console" as const,
    reachable: true,
    hasStreams: true,
    events: [
      {
        eventId: "console-1",
        timestamp: "2026-08-04T10:01:30.000Z",
        kind: "console" as const,
        message: "browser error",
        evidenceRefs: ["console-evidence"],
      },
    ],
  },
  {
    channel: "network" as const,
    reachable: true,
    hasStreams: true,
    events: [
      {
        eventId: "request-1",
        timestamp: "2026-08-04T10:03:45.000Z",
        kind: "network" as const,
        message: "request failed",
        evidenceRefs: ["network-evidence"],
      },
    ],
  },
  {
    channel: "app-log" as const,
    reachable: true,
    hasStreams: true,
    events: [
      {
        eventId: "api-1",
        timestamp: "2026-08-04T10:01:45.000Z",
        kind: "server" as const,
        message: "API error",
        evidenceRefs: ["api-evidence"],
      },
    ],
  },
  {
    channel: "bugsink" as const,
    reachable: true,
    hasStreams: true,
    events: [],
  },
  {
    channel: "loki" as const,
    reachable: true,
    hasStreams: true,
    events: [],
  },
];

const document = (overrides: Partial<EnvironmentFeedbackDocument> = {}) =>
  ({
    canary: { injected: true, detected: true },
    channels: liveChannels(),
    ...overrides,
  }) satisfies EnvironmentFeedbackDocument;

describe("runtime-sweep environment feedback", () => {
  it("correlates browser and server signals to the route timeline", () => {
    const feedback = correlateEnvironmentFeedback({
      timeline,
      document: document(),
    });

    expect(feedback.hits.map((hit) => hit.route)).toEqual([
      "/lead/report",
      "/lead/history",
      "/lead/report",
    ]);
    expect(feedback.hits.map((hit) => hit.channel)).toEqual([
      "browser-console",
      "network",
      "app-log",
    ]);
    expect(feedback.clean).toBe(false);
    expect(feedback.blindChannels).toEqual([]);
  });

  it("never treats a channel without a stream as clean", () => {
    const channels = liveChannels().map((channel) =>
      channel.channel === "loki"
        ? { ...channel, hasStreams: false, events: [] }
        : channel,
    );
    const feedback = correlateEnvironmentFeedback({
      timeline,
      document: document({ channels }),
    });

    expect(feedback.blindChannels).toEqual(["loki"]);
    expect(feedback.clean).toBe(false);
    expect(feedback.blockingReasons).toContain(
      "loki channel is blind (no shipped stream)",
    );
  });

  it("blocks an undetected canary even when every channel is live", () => {
    const feedback = correlateEnvironmentFeedback({
      timeline,
      document: document({ canary: { injected: true, detected: false } }),
    });

    expect(feedback.clean).toBe(false);
    expect(feedback.blockingReasons).toContain(
      "browser console canary was not detected",
    );
  });
});
