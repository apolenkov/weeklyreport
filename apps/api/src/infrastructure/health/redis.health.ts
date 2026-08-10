import type { OnModuleDestroy } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthIndicatorService } from "@nestjs/terminus";
import Redis from "ioredis";

import { ENV_CONFIG } from "../config/config.module";
import type { EnvConfig } from "../config/env.schema";
import { buildFailOpenRedisConnectionOptions } from "../config/redis-connection";

@Injectable()
export class RedisHealthIndicator implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    @Inject(HealthIndicatorService)
    private readonly healthIndicator: HealthIndicatorService,
    @Inject(ENV_CONFIG) env: EnvConfig,
  ) {
    this.redis = new Redis({
      ...buildFailOpenRedisConnectionOptions(env),
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
