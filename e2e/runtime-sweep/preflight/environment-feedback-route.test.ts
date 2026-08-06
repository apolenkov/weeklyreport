import { describe, expect, it } from "vitest";

import { correlateEnvironmentFeedback } from "./environment-feedback.ts";

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

describe("environment event route identity", () => {
  it("preserves an explicit cell route instead of replacing it by timestamp", () => {
    const feedback = correlateEnvironmentFeedback({
      timeline,
      document: {
        canary: { injected: true, detected: true },
        channels: [
          {
            channel: "browser-console",
            reachable: true,
            hasStreams: true,
            events: [
              {
                eventId: "driver-console-1",
                timestamp: timeline.endedAt,
                kind: "console",
                message: "earlier route candidate",
                evidenceRefs: ["transcript:bound"],
                route: "/lead/report",
                cellId: "cell-report",
              },
            ],
          },
        ],
      },
    });

    expect(feedback.hits[0]).toMatchObject({
      route: "/lead/report",
      cellId: "cell-report",
    });
  });
});
