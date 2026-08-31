import type { OnModuleDestroy } from "@nestjs/common";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthIndicatorService } from "@nestjs/terminus";
import { Redis } from "ioredis";

import { errorMessage } from "../../lib/error-message.js";
import { ENV_CONFIG } from "../config/config.module";
import type { EnvConfig } from "../config/env.schema";
import { buildFailOpenRedisConnectionOptions } from "../config/redis-connection";
import { withReadinessTimeout } from "./readiness-timeout.js";

@Injectable()
export class RedisHealthIndicator implements OnModuleDestroy {
  private readonly logger = new Logger(RedisHealthIndicator.name);
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
      await withReadinessTimeout("redis", this.redis.ping());
      return this.healthIndicator.check(key).up();
    } catch (error) {
      this.logger.warn("redis readiness check failed", {
        error: errorMessage(error),
      });
      return this.healthIndicator.check(key).down();
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
