import type { OnModuleDestroy } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthIndicatorService } from "@nestjs/terminus";
import Redis from "ioredis";

@Injectable()
export class RedisHealthIndicator implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly healthIndicator: HealthIndicatorService) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
      lazyConnect: true,
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return this.healthIndicator.check(key).up();
    } catch {
      return this.healthIndicator.check(key).down();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
