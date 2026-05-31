import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  type HealthCheckService,
  type MemoryHealthIndicator,
} from "@nestjs/terminus";
import type { BullMQHealthIndicator } from "./bullmq.health.js";
import type { PrismaHealthIndicator } from "./prisma.health.js";
import type { RedisHealthIndicator } from "./redis.health.js";

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly bullmqHealth: BullMQHealthIndicator,
  ) {}

  @Get("live")
  @HealthCheck()
  liveness() {
    return this.health.check([
      () => this.memory.checkHeap("memory_heap", 200 * 1024 * 1024),
    ]);
  }

  @Get("ready")
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prismaHealth.isHealthy("database"),
      () => this.redisHealth.isHealthy("redis"),
      () => this.bullmqHealth.isHealthy("bullmq"),
      () => this.memory.checkHeap("memory_heap", 200 * 1024 * 1024),
    ]);
  }
}
