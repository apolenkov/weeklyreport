import type { OnModuleDestroy } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import Redis from "ioredis";

import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { buildRedisConnectionOptions } from "../../infrastructure/config/redis-connection";

// Fail-open Redis set of revoked userIds: isActive DB flag is authoritative;
// Redis is a fast-path so in-flight JWTs are rejected without waiting for expiry.
@Injectable()
export class SessionRevocationService implements OnModuleDestroy {
  private readonly redis: Redis;

  // Injected redis for tests; otherwise env is required (fail loud).
  constructor(redis?: Redis, env?: EnvConfig) {
    if (redis) {
      this.redis = redis;
    } else {
      if (!env) {
        throw new Error(
          "SessionRevocationService requires an EnvConfig when no Redis client is injected",
        );
      }
      this.redis = new Redis({
        ...buildRedisConnectionOptions(env),
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      // Suppress unhandled error events on transient Redis blips.
      this.redis.on("error", () => undefined);
    }
  }

  private static readonly KEY = "customreport:revoked";

  // Best-effort — Redis outage must not block the Prisma write.
  async revokeSession(userId: string): Promise<void> {
    try {
      await this.redis.sadd(SessionRevocationService.KEY, userId);
    } catch {
      // Non-fatal: isActive=false is authoritative; Redis is a fast-path cache.
    }
  }

  async restoreSession(userId: string): Promise<void> {
    try {
      await this.redis.srem(SessionRevocationService.KEY, userId);
    } catch {
      // Non-fatal: subsequent request hits Prisma isActive anyway.
    }
  }

  // Fail-open on Redis error so an outage does not lock out all users.
  async isRevoked(userId: string): Promise<boolean> {
    try {
      const result = await this.redis.sismember(
        SessionRevocationService.KEY,
        userId,
      );
      return result === 1;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
