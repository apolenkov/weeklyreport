import { Logger } from "@nestjs/common";
import type { Queue } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../config/env.schema";
import {
  dlqFailedCurrent,
  dlqFailedTotal,
  queueDepth,
  redisMemoryUsedBytes,
} from "../metrics/metrics.registry.js";
import { DLQMonitorService } from "./dlq-monitor.service.js";
import {
  QUEUE_NAMES,
  type QueueName,
  type QueueRegistry,
} from "./queue-registry.js";

// The service touches the registry/env only in onModuleInit (not exercised by
// these Redis-free seam tests); minimal stubs satisfy the constructor.
const STUB_ENV = { REDIS_HOST: "localhost", REDIS_PORT: 6379 } as EnvConfig;
const STUB_REGISTRY = {} as QueueRegistry;

// Seam onto the private, Redis-free logic so it can be tested without a live
// queue connection.
interface DlqTestSeam {
  recordTerminalFailure(
    name: string,
    queue: Pick<Queue, "getJob">,
    jobId: string,
    failedReason: string,
  ): Promise<void>;
}

function seam(): DlqTestSeam {
  return new DLQMonitorService(
    STUB_REGISTRY,
    STUB_ENV,
  ) as unknown as DlqTestSeam;
}

describe("DLQMonitorService.recordTerminalFailure", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => {
      /* silence */
    });
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {
      /* silence */
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("increments cr_dlq_failed_total exactly once for a terminal telegram failure", async () => {
    const inc = vi.spyOn(dlqFailedTotal, "inc");
    const queue: Pick<Queue, "getJob"> = {
      getJob: vi
        .fn()
        .mockResolvedValue({ opts: { attempts: 3 }, attemptsMade: 3 }),
    };

    await seam().recordTerminalFailure(
      "telegram-outbound",
      queue,
      "job-1",
      "boom",
    );

    expect(inc).toHaveBeenCalledExactlyOnceWith({ queue: "telegram-outbound" });
  });

  it("does not increment on a non-terminal (retryable) failure", async () => {
    const inc = vi.spyOn(dlqFailedTotal, "inc");
    const queue: Pick<Queue, "getJob"> = {
      getJob: vi
        .fn()
        .mockResolvedValue({ opts: { attempts: 3 }, attemptsMade: 1 }),
    };

    await seam().recordTerminalFailure("pdf-export", queue, "job-2", "retry");

    expect(inc).not.toHaveBeenCalled();
  });

  it("ignores a failure whose job no longer exists", async () => {
    const inc = vi.spyOn(dlqFailedTotal, "inc");
    const queue: Pick<Queue, "getJob"> = {
      getJob: vi.fn().mockResolvedValue(null),
    };

    await seam().recordTerminalFailure("pdf-export", queue, "gone", "boom");

    expect(inc).not.toHaveBeenCalled();
  });

  it("treats an undefined attempts option as one attempt", async () => {
    const inc = vi.spyOn(dlqFailedTotal, "inc");
    const queue: Pick<Queue, "getJob"> = {
      getJob: vi.fn().mockResolvedValue({ opts: {}, attemptsMade: 1 }),
    };

    await seam().recordTerminalFailure(
      "email-reminder",
      queue,
      "job-default-attempts",
      "boom",
    );

    expect(inc).toHaveBeenCalledExactlyOnceWith({ queue: "email-reminder" });
  });
});

interface PollSeam {
  pollQueueMetrics(threshold: number): Promise<void>;
}

function pollSeam(registry: QueueRegistry): PollSeam {
  return new DLQMonitorService(registry, STUB_ENV) as unknown as PollSeam;
}

describe("DLQMonitorService.pollQueueMetrics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("publishes queue depths and authoritative failed counts in one cycle", async () => {
    const queues = Object.fromEntries(
      QUEUE_NAMES.map((name, index) => [
        name,
        {
          getJobCounts: vi.fn().mockResolvedValue({
            waiting: index + 1,
            active: index + 2,
            delayed: index + 3,
          }),
          getFailedCount: vi.fn().mockResolvedValue(index + 4),
        },
      ]),
    ) as unknown as Record<
      QueueName,
      Pick<Queue, "getFailedCount" | "getJobCounts">
    >;
    const registry = {
      get: vi.fn((name: QueueName) => queues[name]),
    } as unknown as QueueRegistry;
    const depthSet = vi.spyOn(queueDepth, "set");
    const failedSet = vi.spyOn(dlqFailedCurrent, "set");

    await pollSeam(registry).pollQueueMetrics(10);

    expect(depthSet).toHaveBeenCalledTimes(QUEUE_NAMES.length * 3);
    expect(failedSet).toHaveBeenCalledTimes(QUEUE_NAMES.length);
    QUEUE_NAMES.forEach((name, index) => {
      expect(depthSet).toHaveBeenCalledWith(
        { queue: name, state: "waiting" },
        index + 1,
      );
      expect(depthSet).toHaveBeenCalledWith(
        { queue: name, state: "active" },
        index + 2,
      );
      expect(depthSet).toHaveBeenCalledWith(
        { queue: name, state: "delayed" },
        index + 3,
      );
      expect(failedSet).toHaveBeenCalledWith({ queue: name }, index + 4);
    });
  });
});

// REDIS_MAXMEMORY_BYTES = 200mb; 80% of it is the warn boundary.
const REDIS_CAP_BYTES = 209_715_200;
const MEM_ENV = {
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,
  REDIS_MAXMEMORY_BYTES: REDIS_CAP_BYTES,
} as EnvConfig;

interface MemSeam {
  checkRedisMemory(): Promise<void>;
}

// Fake QueueRegistry whose shared connection reports the given used_memory via
// an INFO reply shaped like the real Redis memory section.
function registryReporting(usedMemory: number): QueueRegistry {
  const info = vi
    .fn()
    .mockResolvedValue(
      `# Memory\r\nused_memory:${usedMemory}\r\nused_memory_rss:${usedMemory + 1}\r\n`,
    );
  return {
    get: vi.fn().mockReturnValue({ client: Promise.resolve({ info }) }),
  } as unknown as QueueRegistry;
}

function memSeam(registry: QueueRegistry): MemSeam {
  return new DLQMonitorService(registry, MEM_ENV) as unknown as MemSeam;
}

describe("DLQMonitorService.checkRedisMemory", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {
      /* silence */
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("publishes the gauge and stays quiet below 80% of the cap", async () => {
    const set = vi.spyOn(redisMemoryUsedBytes, "set");
    const warn = vi.spyOn(Logger.prototype, "warn");
    const used = Math.floor(REDIS_CAP_BYTES * 0.5);

    await memSeam(registryReporting(used)).checkRedisMemory();

    expect(set).toHaveBeenCalledExactlyOnceWith(used);
    expect(warn).not.toHaveBeenCalled();
  });

  it("publishes the gauge and warns at or above 80% of the cap", async () => {
    const set = vi.spyOn(redisMemoryUsedBytes, "set");
    const warn = vi.spyOn(Logger.prototype, "warn");
    const used = Math.floor(REDIS_CAP_BYTES * 0.85);

    await memSeam(registryReporting(used)).checkRedisMemory();

    expect(set).toHaveBeenCalledExactlyOnceWith(used);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain("[redis-mem]");
  });

  it("warns at exactly 80% of the cap", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn");
    const used = REDIS_CAP_BYTES * 0.8;

    await memSeam(registryReporting(used)).checkRedisMemory();

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain("[redis-mem]");
  });
});
