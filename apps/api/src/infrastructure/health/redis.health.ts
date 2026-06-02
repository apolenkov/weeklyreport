/* eslint-disable @typescript-eslint/no-deprecated -- whole class is a Terminus HealthIndicator usage (base class, super(), HealthCheckError) pending supervised migration to HealthIndicatorService; see the TODO(ratchet-no-deprecated) markers below. Per-site disables can't be used here: prettier hoists comments off the `extends` heritage clause. */
import type { OnModuleDestroy } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthCheckError, HealthIndicator } from "@nestjs/terminus";
import Redis from "ioredis";

@Injectable()
// TODO(ratchet-no-deprecated): migrate to HealthIndicatorService — inject it, drop HealthIndicator base class
export class RedisHealthIndicator
  extends HealthIndicator
  implements OnModuleDestroy
{
  private readonly redis: Redis;

  constructor() {
    // TODO(ratchet-no-deprecated): migrate to HealthIndicatorService — remove super() after switching base class
    super();
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
      lazyConnect: true,
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return this.getStatus(key, true);
    } catch (_error) {
      // TODO(ratchet-no-deprecated): migrate to HealthIndicatorService (inject it, call .check(), remove HealthCheckError)
      throw new HealthCheckError(
        "Redis check failed",
        this.getStatus(key, false),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
