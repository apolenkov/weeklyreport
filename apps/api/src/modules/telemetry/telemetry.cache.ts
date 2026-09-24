import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";

import {
  createRedisReadThroughCache,
  type RedisReadThroughCache,
} from "../../infrastructure/cache/read-through-cache.js";
import { ENV_CONFIG } from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import type { TelemetryCachePort } from "./telemetry.ports.js";

// 60s TTL (vs analytics' 3600s): the KPI card is the primary leadership view,
// so stale numbers are worse than a slightly hotter Redis. The separate prefix
// keeps telemetry keys off the analytics SCAN-invalidation root.
const TTL_SECONDS = 60;
const PREFIX = "customreport:telemetry:";

@Injectable()
export class TelemetryCache implements TelemetryCachePort, OnModuleDestroy {
  private readonly cache: RedisReadThroughCache;

  constructor(@Inject(ENV_CONFIG) env: EnvConfig) {
    this.cache = createRedisReadThroughCache({
      connection: env,
      loggerName: TelemetryCache.name,
      ttlSeconds: TTL_SECONDS,
      keyPrefix: PREFIX,
    });
  }

  readonly getOrCompute = <T>(
    key: string,
    fn: () => Promise<T>,
    validate?: (value: unknown) => value is T,
  ): Promise<T> => {
    return this.cache.getOrCompute(key, fn, validate);
  };

  readonly onModuleDestroy = (): Promise<void> => {
    return this.cache.close();
  };
}
