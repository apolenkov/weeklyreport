import { beforeEach, describe, expect, it, vi } from "vitest";

import { metricsRegistry } from "../../infrastructure/metrics/metrics.registry.js";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import { SessionRevocationService } from "./session-revocation.service.js";

const REVOCATION_KEY = "customreport:revoked";

interface FakeRedis {
  sadd: ReturnType<typeof vi.fn>;
  srem: ReturnType<typeof vi.fn>;
  sismember: ReturnType<typeof vi.fn>;
  sscan: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
}

function createFakeRedis(): FakeRedis {
  return {
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    sismember: vi.fn().mockResolvedValue(0),
    sscan: vi.fn().mockResolvedValue(["0", []]),
    quit: vi.fn().mockResolvedValue(undefined),
  };
}

// Models the locked identity read the sweep performs: FOR NO KEY UPDATE sees
// only users present in `users`; findUnique then reports their isActive.
function createFakePrisma(users: ReadonlyMap<string, boolean>) {
  const $transaction = vi.fn(async (run: (tx: unknown) => Promise<unknown>) =>
    run({
      $queryRaw: vi.fn((_query: unknown, userId?: string) =>
        Promise.resolve(
          userId !== undefined && users.has(userId) ? [{ id: userId }] : [],
        ),
      ),
      user: {
        findUnique: vi.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(
            users.has(where.id) ? { isActive: users.get(where.id) } : null,
          ),
        ),
      },
    }),
  );
  return { $transaction } as unknown as PrismaService;
}

function createHarness(users: ReadonlyMap<string, boolean> = new Map()): {
  redis: FakeRedis;
  service: SessionRevocationService;
  logger: AppLogger & { warn: ReturnType<typeof vi.fn> };
  prisma: { $transaction: ReturnType<typeof vi.fn> };
} {
  const redis = createFakeRedis();
  const warn = vi.fn();
  const logger = { ...createNullLogger(), warn } as AppLogger & {
    warn: ReturnType<typeof vi.fn>;
  };
  const prisma = createFakePrisma(users);
  return {
    redis,
    logger,
    prisma: prisma as never,
    service: new SessionRevocationService(
      { redis: redis as never, logger },
      prisma,
    ),
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

describe("SessionRevocationService.reconcileRevokedSet", () => {
  const ACTIVE = "00000000-0000-4000-8000-000000000011";
  const INACTIVE = "00000000-0000-4000-8000-000000000012";
  const MISSING = "00000000-0000-4000-8000-000000000013";

  beforeEach(() => {
    metricsRegistry.resetMetrics();
  });

  it("releases a stale member only for a currently active user", async () => {
    const { redis, service } = createHarness(
      new Map([
        [ACTIVE, true],
        [INACTIVE, false],
      ]),
    );
    redis.sscan.mockResolvedValue(["0", [ACTIVE, INACTIVE, MISSING]]);

    await service.reconcileRevokedSet();

    // The active user's stale entry is removed; the deactivated and the
    // missing user are never released — the DB flag bars them anyway.
    expect(redis.srem).toHaveBeenCalledTimes(1);
    expect(redis.srem).toHaveBeenCalledWith(REVOCATION_KEY, ACTIVE);
  });

  it("scans the set in bounded pages and never calls SMEMBERS", async () => {
    const { redis, service } = createHarness(
      new Map([
        [ACTIVE, true],
        [INACTIVE, true],
      ]),
    );
    redis.sscan
      .mockResolvedValueOnce(["7", [ACTIVE]])
      .mockResolvedValueOnce(["0", [INACTIVE]]);

    await service.reconcileRevokedSet();

    expect(redis.sscan).toHaveBeenCalledTimes(2);
    expect(redis.sscan).toHaveBeenNthCalledWith(
      1,
      REVOCATION_KEY,
      "0",
      "COUNT",
      100,
    );
    expect(redis.sscan).toHaveBeenNthCalledWith(
      2,
      REVOCATION_KEY,
      "7",
      "COUNT",
      100,
    );
    expect(redis.srem).toHaveBeenCalledTimes(2);
  });

  it("observes an SSCAN failure and retries on the next sweep", async () => {
    const { redis, service, logger } = createHarness(new Map([[ACTIVE, true]]));
    redis.sscan
      .mockRejectedValueOnce(new Error("redis down"))
      .mockResolvedValueOnce(["0", [ACTIVE]]);

    await service.reconcileRevokedSet();

    expect(redis.srem).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "session-revocation redis failed; fast path degraded",
      expect.objectContaining({ operation: "reconcile" }),
    );

    // The next sweep converges the still-stale entry.
    await service.reconcileRevokedSet();
    expect(redis.srem).toHaveBeenCalledWith(REVOCATION_KEY, ACTIVE);
  });

  it("defers a member whose identity read fails and still processes the rest", async () => {
    const { redis, service } = createHarness(
      new Map([
        [ACTIVE, true],
        [INACTIVE, true],
      ]),
    );
    redis.sscan.mockResolvedValue(["0", [INACTIVE, ACTIVE]]);
    redis.srem
      .mockRejectedValueOnce(new Error("redis down"))
      .mockResolvedValue(1);

    await service.reconcileRevokedSet();

    // The SREM failure on the first member is contained; the second member
    // is still processed in this sweep.
    expect(redis.srem).toHaveBeenCalledTimes(2);
  });

  it("does not start an overlapping sweep while one is in flight", async () => {
    const { redis, service } = createHarness(new Map([[ACTIVE, true]]));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    redis.sscan.mockReturnValueOnce(
      gate.then(() => ["0", [ACTIVE]] as [string, string[]]),
    );

    const first = service.reconcileRevokedSet();
    await service.reconcileRevokedSet();
    release();
    await first;

    expect(redis.sscan).toHaveBeenCalledTimes(1);
  });
});
