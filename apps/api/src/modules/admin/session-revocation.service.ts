import type { OnModuleDestroy } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import Redis from "ioredis";

import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { buildRedisConnectionOptions } from "../../infrastructure/config/redis-connection";

/**
 * Redis-backed session revocation for the
 * deactivate/activate user feature.
 *
 * When an admin deactivates a user the userId is added to the Redis set
 * `customreport:revoked`. The tRPC context factory checks this set on every
 * authenticated request; a hit causes a 401 UNAUTHORIZED so the user is
 * ejected immediately without waiting for their JWT to expire.
 *
 * When an admin re-activates the user the userId is removed from the set so
 * future logins can proceed normally.
 *
 * Pattern mirrors AnalyticsCache — a self-contained ioredis client with
 * lazyConnect + error suppression so a Redis outage degrades gracefully.
 */
@Injectable()
export class SessionRevocationService implements OnModuleDestroy {
  private readonly redis: Redis;

  /**
   * `redis` is an injected client (unit tests); otherwise the service builds
   * its own from `env`. `env` is optional only to keep the redis-first test
   * seam call-compatible — the non-test path passes it or the guard fails loud.
   */
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

  /**
   * Add userId to the revoked set. Called when admin deactivates a user.
   * Best-effort — a Redis outage must not block the Prisma write.
   */
  async revokeSession(userId: string): Promise<void> {
    try {
      await this.redis.sadd(SessionRevocationService.KEY, userId);
    } catch {
      // Non-fatal: the isActive=false DB flag is the authoritative source;
      // Redis is a fast-path cache for in-flight sessions.
    }
  }

  /**
   * Remove userId from the revoked set. Called when admin re-activates a user.
   */
  async restoreSession(userId: string): Promise<void> {
    try {
      await this.redis.srem(SessionRevocationService.KEY, userId);
    } catch {
      // Non-fatal: subsequent request will hit Prisma isActive check anyway.
    }
  }

  /**
   * Returns true when the userId is present in the revoked set.
   * Called from the tRPC context factory on every authenticated request.
   * Returns false on Redis error (fail-open) to prevent a Redis outage from
   * locking out all users — the isActive DB flag is the safety net.
   */
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
