import { HealthIndicatorService } from "@nestjs/terminus";
import type { Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma/prisma.service.js";
import { BullMQHealthIndicator } from "./bullmq.health.js";
import { PrismaHealthIndicator } from "./prisma.health.js";
import { RedisHealthIndicator } from "./redis.health.js";

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
    const indicator = new RedisHealthIndicator(new HealthIndicatorService());
    // Override the internal redis client with a stub that never opens a socket
    const redisMock = {
      ping: vi.fn().mockResolvedValue("PONG"),
      quit: vi.fn(),
    };
    Object.assign(indicator, { redis: redisMock });

    const result = await indicator.isHealthy("redis");

    expect(result).toMatchObject({ redis: { status: "up" } });
  });

  it("returns down result keyed `redis` when ping throws (does NOT throw)", async () => {
    const indicator = new RedisHealthIndicator(new HealthIndicatorService());
    const redisMock = {
      ping: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      quit: vi.fn(),
    };
    Object.assign(indicator, { redis: redisMock });

    const result = await indicator.isHealthy("redis");

    expect(result).toMatchObject({ redis: { status: "down" } });
  });
});

// ---------------------------------------------------------------------------
// BullMQHealthIndicator
// ---------------------------------------------------------------------------

describe("BullMQHealthIndicator", () => {
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
});
