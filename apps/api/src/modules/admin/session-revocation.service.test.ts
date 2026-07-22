import { describe, expect, it, vi } from "vitest";

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
} {
  const redis = createFakeRedis();
  return {
    redis,
    service: new SessionRevocationService(redis as never),
  };
}

describe("SessionRevocationService", () => {
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
