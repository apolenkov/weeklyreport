import { Logger } from "@nestjs/common";
import type { Queue } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// QueueEvents handlers are captured per instance so tests can emit the same
// stream events BullMQ publishes — without a live Redis connection.
vi.mock("bullmq", () => ({
  QueueEvents: class {
    static readonly instances: {
      name: string;
      handlers: Record<string, (...args: never[]) => void>;
    }[] = [];

    readonly handlers: Record<string, (...args: never[]) => void> = {};

    constructor(readonly name: string) {
      (
        this.constructor as typeof import("bullmq").QueueEvents & {
          instances: {
            name: string;
            handlers: Record<string, (...args: never[]) => void>;
          }[];
        }
      ).instances.push(this);
    }

    on(event: string, handler: (...args: never[]) => void): this {
      this.handlers[event] = handler;
      return this;
    }

    close() {
      return Promise.resolve();
    }

    disconnect() {
      /* no-op for the test double */
    }
  },
}));

import { QueueEvents } from "bullmq";

import type { EnvConfig } from "../config/env.schema";
import {
  dlqFailedCurrent,
  dlqFailedTotal,
  queueDepth,
  redisMemoryUsedBytes,
} from "../metrics/metrics.registry.js";
import {
  DLQMonitorService,
  type QueueRegistryLike,
} from "./dlq-monitor.service.js";
import { QUEUE_NAMES, type QueueName } from "./queue-registry.js";

// The service touches the registry/env only in onModuleInit (not exercised by
// these Redis-free seam tests); minimal stubs satisfy the constructor.
const STUB_ENV = {
  REDIS_DB: 15,
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,
} as EnvConfig;
const STUB_REGISTRY: QueueRegistryLike = {
  get: () => {
    throw new Error("registry never read by these seam tests");
  },
};
const STUB_MEMORY_CLIENT = {
  info: () => Promise.reject(new Error("memory client not used by this test")),
  disconnect: vi.fn(),
};

// Seam onto the private, Redis-free logic so it can be tested without a live
// queue connection.
interface DlqTestSeam {
  recordTerminalFailure(
    name: QueueName,
    jobId: string,
    failedReason: string,
  ): void;
}

function seam(): DlqTestSeam {
  return new DLQMonitorService(
    STUB_REGISTRY,
    STUB_ENV,
    STUB_MEMORY_CLIENT,
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

  it("increments once per received terminal failed event", () => {
    const inc = vi.spyOn(dlqFailedTotal, "inc");

    seam().recordTerminalFailure("pdf-export", "job-2", "render refused");
    seam().recordTerminalFailure("pdf-export", "job-3", "render refused");

    expect(inc).toHaveBeenCalledTimes(2);
    expect(inc).toHaveBeenCalledWith({ queue: "pdf-export" });
  });

  // An UnrecoverableError terminalizes the job mid-budget; the 'failed' event
  // is already the terminal signal, so the counter must not gate on attempts.
  it("counts an early unrecoverable failure that never exhausted retries", () => {
    const inc = vi.spyOn(dlqFailedTotal, "inc");

    seam().recordTerminalFailure(
      "pdf-export",
      "job-1-g1",
      "payload is missing a valid generation",
    );

    expect(inc).toHaveBeenCalledExactlyOnceWith({ queue: "pdf-export" });
  });

  it("counts a failed event whose job hash was already removed", () => {
    // Retention (removeOnFail) or a manual removal can delete the job hash
    // between the event and any later read; the event itself is the record.
    const inc = vi.spyOn(dlqFailedTotal, "inc");

    seam().recordTerminalFailure("email-reminder", "gone", "boom");

    expect(inc).toHaveBeenCalledExactlyOnceWith({ queue: "email-reminder" });
  });

  it("logs the failure without claiming a retry-budget exhaustion", () => {
    const error = vi.spyOn(Logger.prototype, "error");

    seam().recordTerminalFailure("pdf-export", "job-9", "renderer gone");

    expect(error).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("job-9"),
    );
    const message = String(error.mock.calls[0]?.[0]);
    expect(message).toContain("pdf-export");
    expect(message).toContain("renderer gone");
    expect(message).not.toMatch(/exhausted|attempts/i);
  });
});

// The QueueEvents surface: only a terminal 'failed' event may count — the
// per-attempt 'waiting'/'delayed' transitions of an ordinary retry must not.
describe("DLQMonitorService failed-event wiring", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => {
      /* silence */
    });
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

  function queueEventsInstances(): {
    name: string;
    handlers: Record<string, (...args: never[]) => void>;
  }[] {
    return (
      QueueEvents as unknown as {
        instances: {
          name: string;
          handlers: Record<string, (...args: never[]) => void>;
        }[];
      }
    ).instances;
  }

  it("counts 'failed' events and ignores 'waiting'/'delayed' retry transitions", async () => {
    const inc = vi.spyOn(dlqFailedTotal, "inc");
    const monitor = new DLQMonitorService(
      STUB_REGISTRY,
      STUB_ENV,
      STUB_MEMORY_CLIENT,
    );
    try {
      monitor.onModuleInit();
      const pdfEvents = queueEventsInstances().find(
        (instance) => instance.name === "pdf-export",
      );
      expect(pdfEvents?.handlers.failed).toBeTypeOf("function");
      expect(pdfEvents?.handlers.waiting).toBeUndefined();
      expect(pdfEvents?.handlers.delayed).toBeUndefined();

      // An early terminal failure (e.g. UnrecoverableError on attempt 1 of 3)
      // publishes the same 'failed' event as an exhausted retry budget.
      pdfEvents?.handlers.failed?.({
        jobId: "job-1-g1",
        failedReason: "unrecoverable",
      } as never);

      expect(inc).toHaveBeenCalledExactlyOnceWith({ queue: "pdf-export" });
    } finally {
      await monitor.onModuleDestroy();
    }
  });
});

interface PollSeam {
  pollQueueMetrics(threshold: number): Promise<void>;
}

function pollSeam(registry: QueueRegistryLike): PollSeam {
  return new DLQMonitorService(
    registry,
    STUB_ENV,
    STUB_MEMORY_CLIENT,
  ) as unknown as PollSeam;
}

describe("DLQMonitorService.pollQueueMetrics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("publishes queue depths and authoritative failed counts in one cycle", async () => {
    const queues = QUEUE_NAMES.reduce<
      Record<QueueName, Pick<Queue, "getFailedCount" | "getJobCounts">>
    >(
      (acc, name, index) => {
        acc[name] = {
          getJobCounts: vi.fn(() =>
            Promise.resolve({
              waiting: index + 1,
              active: index + 2,
              delayed: index + 3,
            }),
          ),
          getFailedCount: vi.fn(() => Promise.resolve(index + 4)),
        };
        return acc;
      },
      {} as Record<QueueName, Pick<Queue, "getFailedCount" | "getJobCounts">>,
    );
    const registry: QueueRegistryLike = {
      get: (name) => queues[name] as unknown as Queue,
    };
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
  REDIS_DB: 15,
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,
  REDIS_MAXMEMORY_BYTES: REDIS_CAP_BYTES,
} as EnvConfig;

interface MemSeam {
  checkRedisMemory(): Promise<void>;
}

// Fake dedicated Redis probe reports the given used_memory via an INFO reply
// shaped like the real Redis memory section.
function memoryClientReporting(usedMemory: number): {
  readonly info: () => Promise<string>;
  readonly disconnect: () => void;
} {
  const info = vi
    .fn()
    .mockResolvedValue(
      `# Memory\r\nused_memory:${usedMemory}\r\nused_memory_rss:${usedMemory + 1}\r\n`,
    );
  return { info, disconnect: vi.fn() };
}

function memSeam(usedMemory: number): MemSeam {
  return new DLQMonitorService(
    STUB_REGISTRY,
    MEM_ENV,
    memoryClientReporting(usedMemory),
  ) as unknown as MemSeam;
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

    await memSeam(used).checkRedisMemory();

    expect(set).toHaveBeenCalledExactlyOnceWith(used);
    expect(warn).not.toHaveBeenCalled();
  });

  it("publishes the gauge and warns at or above 80% of the cap", async () => {
    const set = vi.spyOn(redisMemoryUsedBytes, "set");
    const warn = vi.spyOn(Logger.prototype, "warn");
    const used = Math.floor(REDIS_CAP_BYTES * 0.85);

    await memSeam(used).checkRedisMemory();

    expect(set).toHaveBeenCalledExactlyOnceWith(used);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain("[redis-mem]");
  });

  it("warns at exactly 80% of the cap", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn");
    const used = REDIS_CAP_BYTES * 0.8;

    await memSeam(used).checkRedisMemory();

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain("[redis-mem]");
  });
});
