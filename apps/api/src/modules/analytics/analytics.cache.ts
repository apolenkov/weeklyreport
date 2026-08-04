import type { OnModuleDestroy } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";

import {
  createRedisReadThroughCache,
  type RedisReadThroughCache,
} from "../../infrastructure/cache/read-through-cache.js";
import { ENV_CONFIG } from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import type { AnalyticsCachePort } from "./analytics.service.js";

const TTL_SECONDS = 3600;
// App-namespaced under `customreport:` so analytics keys never collide with
// other apps on the shared Redis. AnalyticsService builds full keys under this
// root, so the shared cache adds no key prefix; invalidateAll SCANs the root.
const PREFIX = "customreport:analytics:";

// invalidateAll is called from every publish path and from reopen.
@Injectable()
export class AnalyticsCache implements AnalyticsCachePort, OnModuleDestroy {
  private readonly cache: RedisReadThroughCache;

  constructor(@Inject(ENV_CONFIG) env: EnvConfig) {
    this.cache = createRedisReadThroughCache({
      connection: env,
      loggerName: AnalyticsCache.name,
      ttlSeconds: TTL_SECONDS,
      keyPrefix: "",
    });
  }

  readonly getOrCompute = <T>(
    key: string,
    fn: () => Promise<T>,
    validate?: (value: unknown) => boolean,
  ): Promise<T> => {
    return this.cache.getOrCompute(key, fn, validate);
  };

  readonly invalidateAll = (): Promise<void> => {
    return this.cache.invalidateByPrefix(PREFIX);
  };

  readonly onModuleDestroy = (): Promise<void> => {
    return this.cache.close();
  };
}
