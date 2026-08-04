import { beforeEach, describe, expect, it, vi } from "vitest";

import { metricsRegistry } from "../../infrastructure/metrics/metrics.registry.js";
import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import { SessionRevocationService } from "./session-revocation.service.js";

const REVOCATION_KEY = "customreport:revoked";

interface FakeRedis {
  sadd: ReturnType<typeof vi.fn>;
  srem: ReturnType<typeof vi.fn>;
  sismember: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
}

function createFakeRedis(): FakeRedis {
  return {
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    sismember: vi.fn().mockResolvedValue(0),
    quit: vi.fn().mockResolvedValue(undefined),
  };
}

function createHarness(): {
  redis: FakeRedis;
  service: SessionRevocationService;
  logger: AppLogger & { warn: ReturnType<typeof vi.fn> };
} {
  const redis = createFakeRedis();
  const warn = vi.fn();
  const logger = { ...createNullLogger(), warn } as AppLogger & {
    warn: ReturnType<typeof vi.fn>;
  };
  return {
    redis,
    logger,
    service: new SessionRevocationService({ redis: redis as never, logger }),
  };
}

describe("SessionRevocationService", () => {
  beforeEach(() => {
    metricsRegistry.resetMetrics();
  });

  it("revokeSession adds userId to the revoked set", async () => {
    const { redis, service } = createHarness();
    const userId = "00000000-0000-4000-8000-000000000001";
    await service.revokeSession(userId);
    expect(redis.sadd).toHaveBeenCalledWith(REVOCATION_KEY, userId);
  });

  it("restoreSession removes userId from the revoked set", async () => {
    const { redis, service } = createHarness();
    const userId = "00000000-0000-4000-8000-000000000002";
    await service.restoreSession(userId);
    expect(redis.srem).toHaveBeenCalledWith(REVOCATION_KEY, userId);
  });

  it("isRevoked returns true when userId is in the revoked set", async () => {
    const { redis, service } = createHarness();
    const userId = "00000000-0000-4000-8000-000000000003";
    redis.sismember.mockResolvedValue(1);
    const result = await service.isRevoked(userId);
    expect(result).toBe(true);
    expect(redis.sismember).toHaveBeenCalledWith(REVOCATION_KEY, userId);
  });

  it("isRevoked returns false when userId is absent from the revoked set", async () => {
    const { redis, service } = createHarness();
    const userId = "00000000-0000-4000-8000-000000000004";
    const result = await service.isRevoked(userId);
    expect(result).toBe(false);
    expect(redis.sismember).toHaveBeenCalledWith(REVOCATION_KEY, userId);
  });

  it("revokeSession then restoreSession targets the same user and set", async () => {
    const { redis, service } = createHarness();
    const userId = "00000000-0000-4000-8000-000000000005";
    await service.revokeSession(userId);
    await service.restoreSession(userId);
    expect(redis.sadd).toHaveBeenCalledWith(REVOCATION_KEY, userId);
    expect(redis.srem).toHaveBeenCalledWith(REVOCATION_KEY, userId);
  });
});

describe("SessionRevocationService — Redis failure observability", () => {
  beforeEach(() => {
    metricsRegistry.resetMetrics();
  });

  it("isRevoked fails OPEN on a Redis error but emits a warn log and metric", async () => {
    const { redis, service, logger } = createHarness();
    redis.sismember.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const userId = "00000000-0000-4000-8000-000000000006";

    const result = await service.isRevoked(userId);

    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "session-revocation redis failed; fast path degraded",
      expect.objectContaining({ operation: "check" }),
    );
    expect(await metricsRegistry.metrics()).toContain(
      'cr_session_revocation_failures_total{operation="check"} 1',
    );
  });

  it("revokeSession stays non-fatal on a Redis error but emits a warn log and metric", async () => {
    const { redis, service, logger } = createHarness();
    redis.sadd.mockRejectedValue(new Error("redis down"));
    const userId = "00000000-0000-4000-8000-000000000007";

    await expect(service.revokeSession(userId)).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      "session-revocation redis failed; fast path degraded",
      expect.objectContaining({ operation: "revoke" }),
    );
    expect(await metricsRegistry.metrics()).toContain(
      'cr_session_revocation_failures_total{operation="revoke"} 1',
    );
  });

  it("restoreSession stays non-fatal on a Redis error but emits a warn log and metric", async () => {
    const { redis, service, logger } = createHarness();
    redis.srem.mockRejectedValue(new Error("redis down"));
    const userId = "00000000-0000-4000-8000-000000000008";

    await expect(service.restoreSession(userId)).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "session-revocation redis failed; fast path degraded",
      expect.objectContaining({ operation: "restore" }),
    );
    expect(await metricsRegistry.metrics()).toContain(
      'cr_session_revocation_failures_total{operation="restore"} 1',
    );
  });
});
