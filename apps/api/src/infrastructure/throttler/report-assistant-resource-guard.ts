import { randomUUID } from "node:crypto";

import { REPORT_ASSISTANT_RESOURCE_RETRY_MAX_SECONDS } from "@customreport/shared";
import type { OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";

import type { AppLogger } from "../../lib/logger.js";
import type {
  ReportAssistantResourceDecision,
  ReportAssistantResourceGuardPort,
} from "../../modules/search/index.js";
import type { EnvConfig } from "../config/env.schema.js";
import { buildRedisConnectionOptions } from "../config/redis-connection.js";
import { customreportAssistantResourceEventsTotal } from "../metrics/report-assistant.metrics.js";

const REQUEST_LIMIT = 20;
const WINDOW_MS = 60_000;
const MAX_IN_FLIGHT = 2;
const MILLISECONDS_PER_SECOND = 1000;
const LEASE_MS =
  REPORT_ASSISTANT_RESOURCE_RETRY_MAX_SECONDS * MILLISECONDS_PER_SECOND;
const LEASE_RENEWAL_INTERVAL_MS = 40_000;
const REDIS_COMMAND_TIMEOUT_MS = 5000;
const DECISION_PART_COUNT = 3;
const ACQUIRE_KEY_COUNT = 3;
const CANCEL_KEY_COUNT = 3;
const CANCEL_TOMBSTONE_MS = Math.max(WINDOW_MS, LEASE_MS) * 2;
const KEY_PREFIX = "customreport:assistant-resource:v1:";

export const REPORT_ASSISTANT_ACQUIRE_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local windowMs = tonumber(ARGV[1])
local requestLimit = tonumber(ARGV[2])
local maxInFlight = tonumber(ARGV[3])
local leaseMs = tonumber(ARGV[4])
local token = ARGV[5]
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - windowMs)
if redis.call('EXISTS', KEYS[3]) == 1 then return {0, 3, 1} end
local existingLease = redis.call('ZSCORE', KEYS[2], token)
if existingLease ~= false then
  return {1, 0, math.max(tonumber(existingLease) - now, 1)}
end
if tonumber(redis.call('ZCARD', KEYS[2])) >= maxInFlight then
  local oldestLease = redis.call('ZRANGE', KEYS[2], 0, 0, 'WITHSCORES')
  return {0, 2, math.max(tonumber(oldestLease[2]) - now, 1)}
end
if tonumber(redis.call('ZCARD', KEYS[1])) >= requestLimit then
  local oldestRequest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, 1, math.max(tonumber(oldestRequest[2]) + windowMs - now, 1)}
end
redis.call('ZADD', KEYS[1], now, token)
redis.call('PEXPIRE', KEYS[1], windowMs * 2)
redis.call('ZADD', KEYS[2], now + leaseMs, token)
redis.call('PEXPIRE', KEYS[2], leaseMs * 2)
return {1, 0, leaseMs}
`;
export const REPORT_ASSISTANT_RELEASE_SCRIPT = `return redis.call('ZREM', KEYS[1], ARGV[1])`;
export const REPORT_ASSISTANT_CANCEL_SCRIPT = `
redis.call('SET', KEYS[3], '1', 'PX', tonumber(ARGV[2]))
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('ZREM', KEYS[2], ARGV[1])
return 1
`;
export const REPORT_ASSISTANT_RENEW_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
if redis.call('ZSCORE', KEYS[1], ARGV[1]) == false then return 0 end
redis.call('ZADD', KEYS[1], now + tonumber(ARGV[2]), ARGV[1])
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[2]) * 2)
return 1
`;

export class ReportAssistantResourceGuard
  implements ReportAssistantResourceGuardPort, OnModuleDestroy
{
  private readonly redis: Redis;
  private readonly activeLeases = new Map<
    string,
    Readonly<{
      controller: AbortController;
      renewalTimer: ReturnType<typeof setInterval>;
    }>
  >();
  private destroyed = false;
  private lastUnavailableLogAt = 0;

  constructor(
    env: Pick<EnvConfig, "REDIS_DB" | "REDIS_HOST" | "REDIS_PORT">,
    private readonly logger: AppLogger,
  ) {
    this.redis = new Redis({
      ...buildRedisConnectionOptions(env),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
    });
    this.redis.on("error", () => undefined);
  }

  async acquire(actorId: string): Promise<ReportAssistantResourceDecision> {
    if (this.destroyed) {
      return { kind: "denied", reason: "unavailable", retryAfterSeconds: 1 };
    }
    const token = randomUUID();
    const budgetKey = `${KEY_PREFIX}budget:${actorId}`;
    const leaseKey = `${KEY_PREFIX}leases:${actorId}`;
    const cancelKey = `${KEY_PREFIX}cancel:${token}`;
    try {
      const result = await this.redis.eval(
        REPORT_ASSISTANT_ACQUIRE_SCRIPT,
        ACQUIRE_KEY_COUNT,
        budgetKey,
        leaseKey,
        cancelKey,
        WINDOW_MS,
        REQUEST_LIMIT,
        MAX_IN_FLIGHT,
        LEASE_MS,
        token,
      );
      if (
        !Array.isArray(result) ||
        result.length !== DECISION_PART_COUNT ||
        result.some((value) => typeof value !== "number")
      ) {
        throw new Error(
          "report assistant resource guard returned an invalid decision",
        );
      }
      if (result[0] !== 1) {
        const reason =
          result[1] === 1
            ? "budget"
            : result[1] === 2
              ? "concurrency"
              : "unavailable";
        this.observe("denied", reason);
        return {
          kind: "denied",
          reason,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil(result[2] / MILLISECONDS_PER_SECOND),
          ),
        };
      }
      this.observe("granted", "none");
      return this.grantLease(token, leaseKey);
    } catch (error) {
      await this.redis
        .eval(
          REPORT_ASSISTANT_CANCEL_SCRIPT,
          CANCEL_KEY_COUNT,
          budgetKey,
          leaseKey,
          cancelKey,
          token,
          CANCEL_TOMBSTONE_MS,
        )
        .catch(() => undefined);
      this.observe("denied", "unavailable");
      this.logUnavailable("deny", error);
      return { kind: "denied", reason: "unavailable", retryAfterSeconds: 1 };
    }
  }

  private grantLease(
    token: string,
    leaseKey: string,
  ): ReportAssistantResourceDecision {
    const controller = new AbortController();
    const leaseState = { released: false };
    const stopRenewal = (): void => {
      const active = this.activeLeases.get(token);
      if (!active) return;
      clearInterval(active.renewalTimer);
      this.activeLeases.delete(token);
    };
    const renew = async (): Promise<void> => {
      if (leaseState.released || controller.signal.aborted || this.destroyed)
        return;
      try {
        const renewed = await this.redis.eval(
          REPORT_ASSISTANT_RENEW_SCRIPT,
          1,
          leaseKey,
          token,
          LEASE_MS,
        );
        if (renewed !== 1) {
          this.observe("renew_failed", "expired");
          controller.abort();
          stopRenewal();
        }
      } catch (error) {
        this.observe("renew_failed", "unavailable");
        this.logUnavailable("renew_failed", error);
        controller.abort();
        stopRenewal();
      }
    };
    const renewalTimer = setInterval(() => {
      void renew();
    }, LEASE_RENEWAL_INTERVAL_MS);
    renewalTimer.unref();
    this.activeLeases.set(token, { controller, renewalTimer });
    return {
      kind: "granted",
      lease: {
        signal: controller.signal,
        release: async () => {
          if (leaseState.released) return;
          leaseState.released = true;
          stopRenewal();
          if (!this.destroyed) await this.release(leaseKey, token);
        },
      },
    };
  }

  private async release(leaseKey: string, token: string): Promise<void> {
    try {
      await this.redis.eval(
        REPORT_ASSISTANT_RELEASE_SCRIPT,
        1,
        leaseKey,
        token,
      );
      this.observe("released", "none");
    } catch (error) {
      this.observe("release_failed", "unavailable");
      this.logUnavailable("release_failed", error);
    }
  }

  private observe(
    outcome:
      "denied" | "granted" | "released" | "release_failed" | "renew_failed",
    reason: "budget" | "concurrency" | "expired" | "none" | "unavailable",
  ): void {
    customreportAssistantResourceEventsTotal.inc({ outcome, reason });
  }

  private logUnavailable(
    outcome: "deny" | "release_failed" | "renew_failed",
    error: unknown,
  ): void {
    const now = Date.now();
    if (now - this.lastUnavailableLogAt < WINDOW_MS) return;
    this.lastUnavailableLogAt = now;
    this.logger.error("report assistant resource guard unavailable", {
      phase: "report-assistant.resources",
      outcome,
      errorType: error instanceof Error ? error.name : typeof error,
    });
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    for (const { controller, renewalTimer } of this.activeLeases.values()) {
      controller.abort();
      clearInterval(renewalTimer);
    }
    this.activeLeases.clear();
    this.redis.disconnect();
  }
}
