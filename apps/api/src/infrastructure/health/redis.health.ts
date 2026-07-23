import type { OnModuleDestroy } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthIndicatorService } from "@nestjs/terminus";
import Redis from "ioredis";

import { ENV_CONFIG } from "../config/config.module";
import type { EnvConfig } from "../config/env.schema";
import { buildRedisConnectionOptions } from "../config/redis-connection";

/**
 * Upper bound on a readiness ping. Fail-fast comes from this timeout plus
 * `maxRetriesPerRequest: 1` — NOT from disabling the offline queue: with
 * `lazyConnect`, a disabled queue rejects the very first ping while the
 * client is still connecting (measured: deterministic false "down" at
 * process start against a healthy Redis), whereas a queued ping resolves the
 * moment the connection is ready and can never outlive this bound.
 */
const PING_TIMEOUT_MS = 2000;

@Injectable()
export class RedisHealthIndicator implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
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
