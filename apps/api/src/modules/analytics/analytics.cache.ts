import type { OnModuleDestroy } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";

import type { AnalyticsCachePort } from "./analytics.service.js";

const TTL_SECONDS = 3600;
// Phase 32-C / M-04: app-namespaced under `customreport:` so analytics keys
// do not collide with other applications sharing the Redis instance. Must
// stay in lockstep with the sub-prefixes in analytics.service.ts.
const PREFIX = "customreport:analytics:";

/**
 * AnalyticsCache — read-through Redis cache for the analytics namespace.
 *
 * Cache misses must NOT break the read path (defense-in-depth): a Redis
 * outage degrades to direct repository calls. Writes are best-effort.
 *
 * Invalidation uses SCAN + DEL over the `customreport:analytics:*` prefix
 * (NOT KEYS, which is O(N) blocking). Called from PeriodService.publishPeriod
 * / reopenPeriod via a constructor-injected port so the period service stays
 * Redis-free for unit tests.
 */
@Injectable()
export class AnalyticsCache implements AnalyticsCachePort, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsCache.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    // Suppress unhandled error events on transient Redis blips — handler
    // keeps the Node process alive when Redis is down.
    this.redis.on("error", () => undefined);
  }

  async getOrCompute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached !== null) {
        this.logger.debug(`cache hit key=${key}`);
        return JSON.parse(cached) as T;
      }
    } catch {
      // Cache failure is non-fatal — fall through to compute.
    }
    this.logger.debug(`cache miss key=${key}`);
    const fresh = await fn();
    try {
      await this.redis.setex(key, TTL_SECONDS, JSON.stringify(fresh));
    } catch {
      // Cache write failure is non-fatal.
    }
    return fresh;
  }

  async invalidateAll(): Promise<void> {
    try {
      let cursor = "0";
      do {
        const [next, batch] = await this.redis.scan(
          cursor,
          "MATCH",
          `${PREFIX}*`,
          "COUNT",
          100,
        );
        if (batch.length > 0) {
          await this.redis.del(...batch);
        }
        cursor = next;
      } while (cursor !== "0");
    } catch {
      // Best-effort invalidation; subsequent reads still hit TTL within the hour.
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
