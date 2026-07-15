import { HealthIndicatorService } from "@nestjs/terminus";
import type { Queue } from "bullmq";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BullMQHealthIndicator } from "./bullmq.health.js";

function pendingQueue(): Queue {
  return {
    getJobCounts: vi.fn(() => new Promise<never>(() => undefined)),
  } as unknown as Queue;
}

describe("BullMQHealthIndicator timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves down when both job-count probes never settle", async () => {
    vi.useFakeTimers();
    const indicator = new BullMQHealthIndicator(
      pendingQueue(),
      pendingQueue(),
      new HealthIndicatorService(),
    );

    const resultPromise = indicator.isHealthy("bullmq");
    await vi.runAllTimersAsync();

    const result = await resultPromise;
    expect(result).toMatchObject({
      bullmq: { status: "down" },
    });
    expect(JSON.stringify(result)).toContain("timed out");
  });
});
