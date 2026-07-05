import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { buildRedisConnectionOptions } from "../../infrastructure/config/redis-connection";
import type { TelemetryCachePort } from "./telemetry.service.js";

/**
 * Phase 52 (UFB-054) — Redis cache for the `telemetry.summary` tRPC
 * read path. Mirrors the AnalyticsCache shape but uses a separate
 * prefix and a much shorter TTL (60s vs analytics' 3600s) because the
 * KPI card is the primary surfaceable view: stale leadership numbers
 * are a worse failure than a slightly hotter Redis. Reusing
 * AnalyticsCache directly would either widen its TTL semantics or
 * collide with its `customreport:analytics:` prefix.
 *
 * Cache miss never breaks the read path — a Redis outage falls through
 * to direct repository calls. Writes are best-effort.
 */
const TTL_SECONDS = 60;
const PREFIX = "customreport:telemetry:";

@Injectable()
export class TelemetryCache implements TelemetryCachePort, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryCache.name);
  private readonly redis: Redis;

  constructor(env: EnvConfig) {
    this.redis = new Redis({
      ...buildRedisConnectionOptions(env),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    // Suppress unhandled error events on transient Redis blips — the
    // service is designed to degrade gracefully to direct queries.
    this.redis.on("error", () => undefined);
  }

  async getOrCompute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const namespaced = `${PREFIX}${key}`;
    try {
      const cached = await this.redis.get(namespaced);
      if (cached !== null) {
        this.logger.debug(`cache hit key=${key}`);
        return JSON.parse(cached) as T;
      }
    } catch {
      // Cache miss/failure → fall through to compute.
    }
    this.logger.debug(`cache miss key=${key}`);
    const fresh = await fn();
    try {
      await this.redis.setex(namespaced, TTL_SECONDS, JSON.stringify(fresh));
    } catch {
      // Cache write failure is non-fatal.
    }
    return fresh;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
