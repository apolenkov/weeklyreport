import type { OnModuleDestroy } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthIndicatorService } from "@nestjs/terminus";
import Redis from "ioredis";

import { ENV_CONFIG } from "../config/config.module";
import type { EnvConfig } from "../config/env.schema";
import { buildRedisConnectionOptions } from "../config/redis-connection";

// Fail-fast via this timeout + maxRetriesPerRequest:1 — not by disabling the
// offline queue: with lazyConnect a disabled queue rejects the first ping while
// still connecting (measured false "down" at boot against healthy Redis).
const PING_TIMEOUT_MS = 2000;

@Injectable()
export class RedisHealthIndicator implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    @Inject(HealthIndicatorService)
    private readonly healthIndicator: HealthIndicatorService,
    @Inject(ENV_CONFIG) env: EnvConfig,
  ) {
    this.redis = new Redis({
      ...buildRedisConnectionOptions(env),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      commandTimeout: PING_TIMEOUT_MS,
    });
    // Suppress unhandled error events so a Redis blip cannot crash the process.
    this.redis.on("error", () => undefined);
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return this.healthIndicator.check(key).up();
    } catch {
      return this.healthIndicator.check(key).down();
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
