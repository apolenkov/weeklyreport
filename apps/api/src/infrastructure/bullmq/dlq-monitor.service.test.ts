import { Logger } from "@nestjs/common";
import type { Queue } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../config/env.schema";
import { dlqFailedTotal } from "../metrics/metrics.registry.js";
import { DLQMonitorService } from "./dlq-monitor.service.js";

// The service reads env only in onModuleInit (not exercised by these
// Redis-free seam tests); a minimal stub satisfies the constructor.
const STUB_ENV = { REDIS_HOST: "localhost", REDIS_PORT: 6379 } as EnvConfig;

// Seam onto the private, Redis-free logic so it can be tested without a live
// queue connection.
interface DlqTestSeam {
  parseThreshold(): number;
  recordTerminalFailure(
    name: string,
    queue: Pick<Queue, "getJob">,
    jobId: string,
    failedReason: string,
  ): Promise<void>;
}

function seam(): DlqTestSeam {
  return new DLQMonitorService(STUB_ENV) as unknown as DlqTestSeam;
}

describe("DLQMonitorService.parseThreshold", () => {
  const original = process.env.DLQ_ALERT_THRESHOLD;

  afterEach(() => {
    if (original === undefined) delete process.env.DLQ_ALERT_THRESHOLD;
    else process.env.DLQ_ALERT_THRESHOLD = original;
    vi.restoreAllMocks();
  });

  it("parses a valid numeric threshold", () => {
    process.env.DLQ_ALERT_THRESHOLD = "12";
    expect(seam().parseThreshold()).toBe(12);
  });

  it("falls back to the default and warns on an unparseable value", () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {
      /* silence */
    });
    process.env.DLQ_ALERT_THRESHOLD = "not-a-number";

    expect(seam().parseThreshold()).toBe(5);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain("not-a-number");
  });

  it("uses the default when the env var is unset (no warn)", () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {
      /* silence */
    });
    delete process.env.DLQ_ALERT_THRESHOLD;

    expect(seam().parseThreshold()).toBe(5);
    expect(warn).not.toHaveBeenCalled();
  });
});

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
});
