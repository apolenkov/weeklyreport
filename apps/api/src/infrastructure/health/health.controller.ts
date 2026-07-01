import { Controller, Get, Inject } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from "@nestjs/terminus";

import { ENV_CONFIG } from "../config/config.module.js";
import type { EnvConfig } from "../config/env.schema.js";
import { BullMQHealthIndicator } from "./bullmq.health.js";
import { PrismaHealthIndicator } from "./prisma.health.js";
import { RedisHealthIndicator } from "./redis.health.js";

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly bullmqHealth: BullMQHealthIndicator,
    @Inject(ENV_CONFIG) private readonly env: EnvConfig,
  ) {}

  // Liveness answers only "is the process alive and not deadlocked?" — memory
  // pressure belongs to readiness, since a liveness DOWN triggers a container
  // restart that makes OOM worse rather than better.
  @Get("live")
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  @Get("ready")
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prismaHealth.isHealthy("database"),
      () => this.redisHealth.isHealthy("redis"),
      () => this.bullmqHealth.isHealthy("bullmq"),
      () =>
        this.memory.checkHeap(
          "memory_heap",
          this.env.HEAP_HEALTH_THRESHOLD_BYTES,
        ),
    ]);
  }
}
