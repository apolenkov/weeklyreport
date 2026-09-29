import type { OnModuleDestroy } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";

import { sessionRevocationFailuresTotal } from "../../infrastructure/metrics/metrics.registry.js";
import type { AppLogger } from "../../lib/logger.js";

export interface SessionRevocationDependencies {
  readonly redis: Redis;
  readonly logger: AppLogger;
}

export const SESSION_REVOCATION_DEPS = Symbol("SessionRevocationDeps");

// Fail-open Redis set of revoked userIds: isActive DB flag is authoritative;
// Redis is a fast-path so in-flight JWTs are rejected without waiting for expiry.
@Injectable()
export class SessionRevocationService implements OnModuleDestroy {
  private static readonly KEY = "customreport:revoked";

  private readonly redis: Redis;
  private readonly logger: AppLogger;

  constructor(
    @Inject(SESSION_REVOCATION_DEPS) deps: SessionRevocationDependencies,
  ) {
    this.redis = deps.redis;
    this.logger = deps.logger;
  }

  // The degraded fast path must stay observable (warn log + metric) even
  // though it stays non-fatal: an outage silently weakening revocation would
  // otherwise be invisible until an in-flight JWT survives a deactivation.
  private observeFailure(operation: string, error: unknown): void {
    sessionRevocationFailuresTotal.inc({ operation });
    this.logger.warn("session-revocation redis failed; fast path degraded", {
      phase: "auth.session-revocation",
      operation,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  // Best-effort — Redis outage must not block the Prisma write.
  readonly revokeSession = async (userId: string): Promise<void> => {
    try {
      await this.redis.sadd(SessionRevocationService.KEY, userId);
    } catch (error) {
      // Non-fatal: isActive=false is authoritative; Redis is a fast-path cache.
      this.observeFailure("revoke", error);
    }
  };

  readonly restoreSession = async (userId: string): Promise<void> => {
    try {
      await this.redis.srem(SessionRevocationService.KEY, userId);
    } catch (error) {
      // Non-fatal to activation, but the revoked-set entry may remain until a
      // later restore succeeds.
      this.observeFailure("restore", error);
    }
  };

  // Fail-open on Redis error so an outage does not lock out all users.
  readonly isRevoked = async (userId: string): Promise<boolean> => {
    try {
      const result = await this.redis.sismember(
        SessionRevocationService.KEY,
        userId,
      );
      return result === 1;
    } catch (error) {
      this.observeFailure("check", error);
      return false;
    }
  };

  readonly onModuleDestroy = async (): Promise<void> => {
    await this.redis.quit().catch(() => undefined);
  };
}
