import { aiProviderRuntimeFailureSchema } from "@customreport/shared";
import type { OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";

import type { EnvConfig } from "../../../infrastructure/config/env.schema.js";
import { buildFailOpenRedisConnectionOptions } from "../../../infrastructure/config/redis-connection.js";
import type {
  AiRuntimeFailure,
  AiRuntimeHealth,
} from "../application/ai-runtime-health.js";

const KEY = "customreport:ai-runtime-failure:v1";
// Stale enough to stop alarming an admin once nobody retries the chat.
const FAILURE_TTL_SECONDS = 900;

export class RedisAiRuntimeHealth implements AiRuntimeHealth, OnModuleDestroy {
  private readonly redis: Redis;

  constructor(env: Pick<EnvConfig, "REDIS_DB" | "REDIS_HOST" | "REDIS_PORT">) {
    this.redis = new Redis(buildFailOpenRedisConnectionOptions(env));
    this.redis.on("error", () => undefined);
  }

  async recordFailure(outcome: AiRuntimeFailure["outcome"]): Promise<void> {
    const failure: AiRuntimeFailure = {
      outcome,
      occurredAt: new Date().toISOString(),
    };
    await this.redis
      .set(KEY, JSON.stringify(failure), "EX", FAILURE_TTL_SECONDS)
      .catch(() => undefined);
  }

  async recordSuccess(): Promise<void> {
    await this.redis.del(KEY).catch(() => undefined);
  }

  async lastFailure(): Promise<AiRuntimeFailure | null> {
    try {
      const raw = await this.redis.get(KEY);
      if (raw === null) return null;
      const parsed = aiProviderRuntimeFailureSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
