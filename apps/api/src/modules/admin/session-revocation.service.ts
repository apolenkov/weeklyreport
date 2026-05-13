import { Injectable, Optional } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

/**
 * A2 (UAT-v7 2026-05-12): Redis-backed session revocation for the
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

  /** Allow injecting a custom redis client (used in unit tests). */
  constructor(@Optional() redis?: Redis) {
    if (redis) {
      this.redis = redis;
    } else {
      this.redis = new Redis({
        host: process.env["REDIS_HOST"] ?? "localhost",
        port: Number(process.env["REDIS_PORT"] ?? 6379),
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
