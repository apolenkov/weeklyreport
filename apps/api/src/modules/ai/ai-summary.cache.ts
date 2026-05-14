// Phase 54 (UFB-055): 60-second Redis cache for `ai.periodSummary`.
//
// Mirrors the TelemetryCache shape (Phase 52) — separate prefix, same
// graceful-degrade contract: a Redis outage falls through to a direct
// adapter call instead of throwing. The adapter is mock-only for now,
// but the cache abstraction stays so the cutover to a real provider
// does not have to introduce caching plumbing under load.

import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

/**
 * Pluggable cache port consumed by AiSummaryService — keeps the
 * service free of ioredis so unit tests can stub a plain in-memory
 * implementation.
 */
export interface AiSummaryCachePort {
  getOrCompute<T>(key: string, fn: () => Promise<T>): Promise<T>;
}

/**
 * Pass-through cache used when Redis is unavailable or when a test
 * wants every call to hit the adapter. Mirrors the
 * NullTelemetryCache pattern.
 */
export class NullAiSummaryCache implements AiSummaryCachePort {
  async getOrCompute<T>(_key: string, fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

const TTL_SECONDS = 60;
const PREFIX = "customreport:ai:summary:";

@Injectable()
export class AiSummaryCache implements AiSummaryCachePort, OnModuleDestroy {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env["REDIS_HOST"] ?? "localhost",
      port: Number(process.env["REDIS_PORT"] ?? 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    // Suppress transient Redis errors — the consumer is designed to
    // degrade gracefully to direct adapter calls.
    this.redis.on("error", () => undefined);
  }

  async getOrCompute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const namespaced = `${PREFIX}${key}`;
    try {
      const cached = await this.redis.get(namespaced);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch {
      // Cache miss / Redis blip → fall through to compute.
    }
    const fresh = await fn();
    try {
      await this.redis.setex(namespaced, TTL_SECONDS, JSON.stringify(fresh));
    } catch {
      // Write failure is non-fatal — next caller will retry.
    }
    return fresh;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
