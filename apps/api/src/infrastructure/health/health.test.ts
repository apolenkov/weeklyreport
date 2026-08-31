import { Logger } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthIndicatorService } from "@nestjs/terminus";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkerLivenessRegistry } from "../bullmq/worker-liveness.registry.js";
import type { EnvConfig } from "../config/env.schema.js";
import { BullMQHealthIndicator } from "./bullmq.health.js";
import { HealthController } from "./health.controller.js";
import { PrismaHealthIndicator } from "./prisma.health.js";
import { READINESS_PROBE_TIMEOUT_MS } from "./readiness-timeout.js";
import { RedisHealthIndicator } from "./redis.health.js";

// lazyConnect keeps the constructed client from opening a socket; the tests
// override the client anyway, so only the host/port shape is needed.
const STUB_ENV = {
  REDIS_DB: 15,
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,
} as EnvConfig;

const explicitInjectionToken = (
  target: abstract new (...args: never[]) => unknown,
  index: number,
): unknown => {
  const metadata = Reflect.getMetadata("self:paramtypes", target) as
    readonly { readonly index: number; readonly param: unknown }[] | undefined;
  return metadata?.find((entry) => entry.index === index)?.param;
};

describe("health provider composition", () => {
  it("injects the application-scoped worker registry into BullMQ readiness", () => {
    expect(explicitInjectionToken(BullMQHealthIndicator, 2)).toBe(
      WorkerLivenessRegistry,
    );
  });

  it.each([
    [RedisHealthIndicator, 0],
    [PrismaHealthIndicator, 1],
    [BullMQHealthIndicator, 3],
  ] as const)(
    "%s declares its HealthIndicatorService injection token for the tsx runtime",
    (provider, index) => {
      expect(explicitInjectionToken(provider, index)).toBe(
        HealthIndicatorService,
      );
    },
  );
});

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
    const health = { check };
    const memory = {
      checkHeap: vi.fn().mockResolvedValue({ memory_heap: { status: "up" } }),
    };
    const up = (key: string): HealthIndicatorResult => ({
      [key]: { status: "up" },
    });
    const prismaHealth = {
      isHealthy: vi.fn((key: string) => Promise.resolve(up(key))),
    };
    const redisHealth = {
      isHealthy: vi.fn((key: string) => Promise.resolve(up(key))),
    };
    const bullmqHealth = {
      isHealthy: vi.fn((key: string) => Promise.resolve(up(key))),
    };
    const env = {
      HEAP_HEALTH_THRESHOLD_BYTES: threshold,
    } as EnvConfig;
    const controller = new HealthController(
      health,
      memory,
      prismaHealth,
      redisHealth,
      bullmqHealth,
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

describe("PrismaHealthIndicator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeIndicator() {
    const prisma = { $queryRaw: vi.fn() };
    const indicator = new PrismaHealthIndicator(
      prisma,
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

  it("returns down when SELECT 1 does not settle before the readiness deadline", async () => {
    vi.useFakeTimers();
    const { indicator, prisma } = makeIndicator();
    prisma.$queryRaw.mockImplementation(
      () => new Promise<never>(() => undefined),
    );

    const resultPromise = indicator.isHealthy("database");
    await vi.advanceTimersByTimeAsync(READINESS_PROBE_TIMEOUT_MS);

    await expect(resultPromise).resolves.toMatchObject({
      database: { status: "down" },
    });
  });

  it("does not leak the raw database error into the readiness body (logs it internally instead)", async () => {
    const { indicator, prisma } = makeIndicator();
    const errorSpy = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    prisma.$queryRaw.mockRejectedValue(
      new Error('password authentication failed for user "app_user"'),
    );

    const result = await indicator.isHealthy("database");

    expect(JSON.stringify(result)).not.toContain("app_user");
    expect(JSON.stringify(result)).not.toContain("authentication");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("database readiness check failed"),
      expect.objectContaining({
        error: 'password authentication failed for user "app_user"',
      }),
    );
  });
});

describe("RedisHealthIndicator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("returns down when ping does not settle before the readiness deadline", async () => {
    vi.useFakeTimers();
    const indicator = new RedisHealthIndicator(
      new HealthIndicatorService(),
      STUB_ENV,
    );
    const redisMock = {
      ping: vi.fn(() => new Promise<never>(() => undefined)),
      disconnect: vi.fn(),
    };
    Object.assign(indicator, { redis: redisMock });

    const resultPromise = indicator.isHealthy("redis");
    await vi.advanceTimersByTimeAsync(READINESS_PROBE_TIMEOUT_MS);

    await expect(resultPromise).resolves.toMatchObject({
      redis: { status: "down" },
    });
  });

  it("logs a safe structured reason when ping fails", async () => {
    const warning = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
    const indicator = new RedisHealthIndicator(
      new HealthIndicatorService(),
      STUB_ENV,
    );
    Object.assign(indicator, {
      redis: {
        ping: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
        disconnect: vi.fn(),
      },
    });

    await indicator.isHealthy("redis");

    expect(warning).toHaveBeenCalledWith("redis readiness check failed", {
      error: "ECONNREFUSED",
    });
    warning.mockRestore();
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

describe("BullMQHealthIndicator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeQueue(counts: { waiting: number; active: number }) {
    return {
      getJobCounts: vi.fn().mockResolvedValue(counts),
    };
  }

  function readyWorkers() {
    const registry = new WorkerLivenessRegistry();
    const handle = { isPaused: () => false, isRunning: () => true };
    registry.register("pdf-export", handle).markReady();
    registry.register("email-reminder", handle).markReady();
    return registry;
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
      readyWorkers(),
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

  it("returns down result keyed `bullmq` without echoing the raw queue error, and logs it internally", async () => {
    const pdfQueue = {
      getJobCounts: vi.fn().mockRejectedValue(new Error("Queue unavailable")),
    };
    const emailQueue = {
      getJobCounts: vi.fn().mockResolvedValue({ waiting: 0, active: 0 }),
    };
    const errorSpy = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const indicator = new BullMQHealthIndicator(
      pdfQueue,
      emailQueue,
      readyWorkers(),
      new HealthIndicatorService(),
    );

    const result = await indicator.isHealthy("bullmq");

    expect(result.bullmq).toMatchObject({ status: "down" });
    expect(result.bullmq?.message).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("Queue unavailable");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("bullmq readiness probe failed"),
      expect.objectContaining({ error: "Queue unavailable" }),
    );
  });

  it("returns down on timeout and safely absorbs a later queue rejection", async () => {
    vi.useFakeTimers();
    const pending = Promise.withResolvers<{
      waiting: number;
      active: number;
    }>();
    const queue = {
      getJobCounts: vi.fn(() => pending.promise),
    };
    const indicator = new BullMQHealthIndicator(
      queue,
      queue,
      readyWorkers(),
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

  it("returns down without probing queues while a required worker is stopped", async () => {
    const pdfQueue = makeQueue({ waiting: 0, active: 0 });
    const emailQueue = makeQueue({ waiting: 0, active: 0 });
    const registry = readyWorkers();
    const stopped = { isPaused: () => false, isRunning: () => false };
    registry.register("email-reminder", stopped).markReady();
    const indicator = new BullMQHealthIndicator(
      pdfQueue,
      emailQueue,
      registry,
      new HealthIndicatorService(),
    );

    await expect(indicator.isHealthy("bullmq")).resolves.toMatchObject({
      bullmq: {
        status: "down",
        workers: { "email-reminder": "stopped", "pdf-export": "ready" },
      },
    });
    expect(pdfQueue.getJobCounts).not.toHaveBeenCalled();
    expect(emailQueue.getJobCounts).not.toHaveBeenCalled();
  });

  it("recovers after the stopped worker is replaced and reports ready", async () => {
    const pdfQueue = makeQueue({ waiting: 0, active: 0 });
    const emailQueue = makeQueue({ waiting: 0, active: 0 });
    const registry = readyWorkers();
    const stopped = { isPaused: () => false, isRunning: () => false };
    registry.register("pdf-export", stopped).markReady();
    const indicator = new BullMQHealthIndicator(
      pdfQueue,
      emailQueue,
      registry,
      new HealthIndicatorService(),
    );
    await expect(indicator.isHealthy("bullmq")).resolves.toMatchObject({
      bullmq: { status: "down" },
    });

    const replacement = { isPaused: () => false, isRunning: () => true };
    registry.register("pdf-export", replacement).markReady();

    await expect(indicator.isHealthy("bullmq")).resolves.toMatchObject({
      bullmq: { status: "up" },
    });
  });
});
