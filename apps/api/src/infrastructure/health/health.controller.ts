import { Controller, Get, Inject } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  type HealthIndicatorResult,
  MemoryHealthIndicator,
} from "@nestjs/terminus";

import { ENV_CONFIG } from "../config/config.module.js";
import type { EnvConfig } from "../config/env.schema.js";
import { BullMQHealthIndicator } from "./bullmq.health.js";
import { PrismaHealthIndicator } from "./prisma.health.js";
import { RedisHealthIndicator } from "./redis.health.js";

// The terminus surfaces this controller consumes; narrow so tests inject
// stubs without erasing casts. The `@HealthCheck()` decorator reshapes the
// check() result for the wire, so the controller never reads its members.
interface HealthCheckRunner {
  check(
    indicators: (() => Promise<HealthIndicatorResult>)[],
  ): Promise<Record<string, unknown>>;
}

interface HeapChecker {
  checkHeap(
    key: string,
    heapUsedThreshold: number,
  ): Promise<HealthIndicatorResult>;
}

interface HealthProbe {
  isHealthy(key: string): Promise<HealthIndicatorResult>;
}

@Controller("health")
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckRunner,
    @Inject(MemoryHealthIndicator) private readonly memory: HeapChecker,
    @Inject(PrismaHealthIndicator) private readonly prismaHealth: HealthProbe,
    @Inject(RedisHealthIndicator) private readonly redisHealth: HealthProbe,
    @Inject(BullMQHealthIndicator) private readonly bullmqHealth: HealthProbe,
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
