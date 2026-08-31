import { HealthIndicatorService } from "@nestjs/terminus";
import type { Queue } from "bullmq";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QueueRegistry } from "../bullmq/queue-registry.js";
import { WorkerLivenessRegistry } from "../bullmq/worker-liveness.registry.js";
import { BullMQHealthIndicator } from "./bullmq.health.js";

function readyWorkers(): WorkerLivenessRegistry {
  const registry = new WorkerLivenessRegistry();
  const worker = { isPaused: () => false, isRunning: () => true };
  registry.register("pdf-export", worker).markReady();
  registry.register("email-reminder", worker).markReady();
  registry.register("ai-provider-test", worker).markReady();
  registry.register("semantic-index", worker).markReady();
  return registry;
}

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
      new QueueRegistry([
        pendingQueue(),
        pendingQueue(),
        pendingQueue(),
        pendingQueue(),
      ]),
      readyWorkers(),
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
