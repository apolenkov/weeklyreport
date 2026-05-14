/**
 * Unit tests for SessionRevocationService (A2: user deactivate/activate).
 *
 * We use a hand-rolled in-memory Redis stub instead of a real Redis instance
 * so the tests run without infrastructure. The stub implements the three
 * ioredis methods the service calls: sadd, srem, sismember.
 */
import { describe, expect, it, beforeEach } from "vitest";

import { SessionRevocationService } from "./session-revocation.service.js";

// ---- Minimal Redis stub ---------------------------------------------------

type FakeRedis = {
  data: Set<string>;
  sadd(key: string, member: string): Promise<number>;
  srem(key: string, member: string): Promise<number>;
  sismember(key: string, member: string): Promise<0 | 1>;
  quit(): Promise<void>;
};

function createFakeRedis(): FakeRedis {
  const data = new Set<string>();
  return {
    data,
    async sadd(_key: string, member: string) {
      const wasAbsent = !data.has(member);
      data.add(member);
      return wasAbsent ? 1 : 0;
    },
    async srem(_key: string, member: string) {
      const wasPresent = data.has(member);
      data.delete(member);
      return wasPresent ? 1 : 0;
    },
    async sismember(_key: string, member: string) {
      return data.has(member) ? 1 : 0;
    },
    async quit() {
      /* no-op */
    },
  };
}

// ---- Tests ----------------------------------------------------------------

describe("SessionRevocationService", () => {
  let redis: FakeRedis;
  let svc: SessionRevocationService;

  beforeEach(() => {
    redis = createFakeRedis();
    // Cast: the service depends only on sadd/srem/sismember/quit — the stub
    // satisfies that interface even though it is not a full ioredis instance.
    svc = new SessionRevocationService(redis as never);
  });

  it("revokeSession adds userId to the revoked set", async () => {
    const userId = "00000000-0000-4000-8000-000000000001";
    await svc.revokeSession(userId);
    expect(redis.data.has(userId)).toBe(true);
  });

  it("restoreSession removes userId from the revoked set", async () => {
    const userId = "00000000-0000-4000-8000-000000000002";
    redis.data.add(userId); // pre-populate
    await svc.restoreSession(userId);
    expect(redis.data.has(userId)).toBe(false);
  });

  it("isRevoked returns true when userId is in the revoked set", async () => {
    const userId = "00000000-0000-4000-8000-000000000003";
    redis.data.add(userId);
    const result = await svc.isRevoked(userId);
    expect(result).toBe(true);
  });

  it("isRevoked returns false when userId is absent from the revoked set", async () => {
    const userId = "00000000-0000-4000-8000-000000000004";
    const result = await svc.isRevoked(userId);
    expect(result).toBe(false);
  });

  it("revokeSession then restoreSession leaves the set clean", async () => {
    const userId = "00000000-0000-4000-8000-000000000005";
    await svc.revokeSession(userId);
    await svc.restoreSession(userId);
    expect(redis.data.has(userId)).toBe(false);
    expect(await svc.isRevoked(userId)).toBe(false);
  });
});
