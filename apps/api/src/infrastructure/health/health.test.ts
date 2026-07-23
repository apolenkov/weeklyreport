import type {
  HealthCheckService,
  HealthIndicatorResult,
  MemoryHealthIndicator,
} from "@nestjs/terminus";
import { HealthIndicatorService } from "@nestjs/terminus";
import type { Queue } from "bullmq";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../config/env.schema.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { BullMQHealthIndicator } from "./bullmq.health.js";
import { HealthController } from "./health.controller.js";
import { PrismaHealthIndicator } from "./prisma.health.js";
import { RedisHealthIndicator } from "./redis.health.js";

// lazyConnect keeps the constructed client from opening a socket; the tests
// override the client anyway, so only the host/port shape is needed.
const STUB_ENV = { REDIS_HOST: "localhost", REDIS_PORT: 6379 } as EnvConfig;

// ---------------------------------------------------------------------------
// HealthController
// ---------------------------------------------------------------------------

describe("HealthController", () => {
  const threshold = 1_610_612_736;

  function makeController() {
    const check = vi.fn(
      async (indicators: (() => Promise<HealthIndicatorResult>)[]) => {
        const results = await Promise.all(indicators.map((run) => run()));
        return results.reduce<Record<string, unknown>>(
          (acc, result) => ({ ...acc, ...result }),
          {},
        );
      },
    );
    const health = { check } as unknown as HealthCheckService;
    const memory = {
      checkHeap: vi.fn().mockResolvedValue({ memory_heap: { status: "up" } }),
    };
    const up = (key: string): HealthIndicatorResult => ({
      [key]: { status: "up" },
    });
    const prismaHealth = { isHealthy: vi.fn((key: string) => up(key)) };
    const redisHealth = { isHealthy: vi.fn((key: string) => up(key)) };
    const bullmqHealth = { isHealthy: vi.fn((key: string) => up(key)) };
    const env = { HEAP_HEALTH_THRESHOLD_BYTES: threshold } as EnvConfig;
    const controller = new HealthController(
      health,
      memory as unknown as MemoryHealthIndicator,
      prismaHealth as unknown as PrismaHealthIndicator,
      redisHealth as unknown as RedisHealthIndicator,
      bullmqHealth as unknown as BullMQHealthIndicator,
      env,
    );
    return { controller, memory, prismaHealth, redisHealth, bullmqHealth };
  }

  it("liveness response carries no memory_heap result", async () => {
    const { controller, memory } = makeController();

    const result = await controller.liveness();

    expect(result).not.toHaveProperty("memory_heap");
    expect(memory.checkHeap).not.toHaveBeenCalled();
  });

  it("readiness calls checkHeap with the threshold from EnvConfig", async () => {
    const { controller, memory, prismaHealth, redisHealth, bullmqHealth } =
      makeController();

    const result = await controller.readiness();

    expect(prismaHealth.isHealthy).toHaveBeenCalledExactlyOnceWith("database");
    expect(redisHealth.isHealthy).toHaveBeenCalledExactlyOnceWith("redis");
    expect(bullmqHealth.isHealthy).toHaveBeenCalledExactlyOnceWith("bullmq");
    expect(memory.checkHeap).toHaveBeenCalledWith("memory_heap", threshold);
    expect(result).toMatchObject({ memory_heap: { status: "up" } });
  });
});

// ---------------------------------------------------------------------------
// PrismaHealthIndicator
// ---------------------------------------------------------------------------

describe("PrismaHealthIndicator", () => {
  function makeIndicator() {
    const prisma = { $queryRaw: vi.fn() };
    const indicator = new PrismaHealthIndicator(
      prisma as unknown as PrismaService,
      new HealthIndicatorService(),
    );
    return { indicator, prisma };
  }

  it("returns up result keyed `database` when SELECT 1 succeeds", async () => {
    const { indicator, prisma } = makeIndicator();
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const result = await indicator.isHealthy("database");

    expect(result).toMatchObject({ database: { status: "up" } });
  });

  it("returns down result keyed `database` when SELECT 1 throws (does NOT throw)", async () => {
    const { indicator, prisma } = makeIndicator();
    prisma.$queryRaw.mockRejectedValue(new Error("connection refused"));

    const result = await indicator.isHealthy("database");

    expect(result).toMatchObject({ database: { status: "down" } });
  });
});

// ---------------------------------------------------------------------------
// RedisHealthIndicator
// ---------------------------------------------------------------------------

describe("RedisHealthIndicator", () => {
  it("returns up result keyed `redis` when ping succeeds", async () => {
    const indicator = new RedisHealthIndicator(
      new HealthIndicatorService(),
      STUB_ENV,
    );
    // Override the internal redis client with a stub that never opens a socket
    const redisMock = {
      ping: vi.fn().mockResolvedValue("PONG"),
      disconnect: vi.fn(),
    };
    Object.assign(indicator, { redis: redisMock });

    const result = await indicator.isHealthy("redis");

    expect(result).toMatchObject({ redis: { status: "up" } });
  });

  it("returns down result keyed `redis` when ping throws (does NOT throw)", async () => {
    const indicator = new RedisHealthIndicator(
      new HealthIndicatorService(),
      STUB_ENV,
    );
    const redisMock = {
      ping: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      disconnect: vi.fn(),
    };
    Object.assign(indicator, { redis: redisMock });

    const result = await indicator.isHealthy("redis");

    expect(result).toMatchObject({ redis: { status: "down" } });
  });

  it("disconnects without issuing a Redis command on module destroy", () => {
    const indicator = new RedisHealthIndicator(
      new HealthIndicatorService(),
      STUB_ENV,
    );
    const redisMock = {
      ping: vi.fn(),
      disconnect: vi.fn(),
    };
    Object.assign(indicator, { redis: redisMock });

    indicator.onModuleDestroy();

    expect(redisMock.disconnect).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// BullMQHealthIndicator
// ---------------------------------------------------------------------------

describe("BullMQHealthIndicator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeQueue(counts: { waiting: number; active: number }) {
    return {
      getJobCounts: vi.fn().mockResolvedValue(counts),
    } as unknown as Queue;
  }

  function makeIndicator(
    pdfCounts = { waiting: 2, active: 1 },
    emailCounts = { waiting: 0, active: 0 },
  ) {
    const pdfQueue = makeQueue(pdfCounts);
    const emailQueue = makeQueue(emailCounts);
    const indicator = new BullMQHealthIndicator(
      pdfQueue,
      emailQueue,
      new HealthIndicatorService(),
    );
    return { indicator, pdfQueue, emailQueue };
  }

  it("returns up result keyed `bullmq` with per-queue counts when queues are healthy", async () => {
    const { indicator } = makeIndicator(
      { waiting: 3, active: 1 },
      { waiting: 0, active: 2 },
    );

    const result = await indicator.isHealthy("bullmq");

    expect(result).toMatchObject({
      bullmq: {
        status: "up",
        pdf_export: { waiting: 3, active: 1 },
        email_reminder: { waiting: 0, active: 2 },
      },
    });
  });

  it("returns down result keyed `bullmq` with message detail when a queue throws (does NOT throw)", async () => {
    const pdfQueue = {
      getJobCounts: vi.fn().mockRejectedValue(new Error("Queue unavailable")),
    };
    const emailQueue = {
      getJobCounts: vi.fn().mockResolvedValue({ waiting: 0, active: 0 }),
    };
    const indicator = new BullMQHealthIndicator(
      pdfQueue as unknown as Queue,
      emailQueue as unknown as Queue,
      new HealthIndicatorService(),
    );

    const result = await indicator.isHealthy("bullmq");

    expect(result).toMatchObject({
      bullmq: {
        status: "down",
        message: "Queue unavailable",
      },
    });
  });

  it("returns down on timeout and safely absorbs a later queue rejection", async () => {
    vi.useFakeTimers();
    const pending = Promise.withResolvers<{
      waiting: number;
      active: number;
    }>();
    const queue = {
      getJobCounts: vi.fn(() => pending.promise),
    } as unknown as Queue;
    const indicator = new BullMQHealthIndicator(
      queue,
      queue,
      new HealthIndicatorService(),
    );

    const resultPromise = indicator.isHealthy("bullmq");
    await vi.runAllTimersAsync();

    const result = await resultPromise;
    expect(result.bullmq).toMatchObject({ status: "down" });
    expect(result.bullmq?.message).toContain("timed out");

    pending.reject(new Error("late queue failure"));
    await Promise.resolve();
  });
});
