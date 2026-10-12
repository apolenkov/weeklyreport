import type { OnModuleDestroy } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Redis } from "ioredis";

import { sessionRevocationFailuresTotal } from "../../infrastructure/metrics/metrics.registry.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AppLogger } from "../../lib/logger.js";
import { lockUser } from "../../lib/user-activity-assignment.js";

export interface SessionRevocationDependencies {
  readonly redis: Redis;
  readonly logger: AppLogger;
}

export const SESSION_REVOCATION_DEPS = Symbol("SessionRevocationDeps");

// Fail-open Redis set of revoked userIds: isActive DB flag is authoritative;
// Redis is a fast-path so in-flight JWTs are rejected without waiting for expiry.
@Injectable()
export class SessionRevocationService implements OnModuleDestroy {
  private static readonly KEY = "weeklyreport:revoked";
  private static readonly SCAN_PAGE_SIZE = 100;

  private readonly redis: Redis;
  private readonly logger: AppLogger;
  private sweepInFlight = false;

  constructor(
    @Inject(SESSION_REVOCATION_DEPS) deps: SessionRevocationDependencies,
    @Inject(PrismaService) private readonly prisma: PrismaService,
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

  // Activation's immediate SREM is best-effort: a Redis outage at that moment
  // leaves a stale member that bars the still-active user once Redis recovers
  // (the revoked check runs before the DB read). This bounded sweep converges
  // the set to the durable isActive state — no TTL, no second admin click.
  @Cron(CronExpression.EVERY_HOUR, { timeZone: "UTC", waitForCompletion: true })
  async reconcileRevokedSet(): Promise<void> {
    // One sweep per process: waitForCompletion covers Nest's own re-entry,
    // and the flag guards any manual invocation while a sweep is running.
    if (this.sweepInFlight) return;
    this.sweepInFlight = true;
    try {
      // eslint-disable-next-line no-restricted-syntax -- the SSCAN cursor is load-bearing: it advances once per bounded page until Redis reports 0.
      let cursor = "0";
      do {
        const [next, members] = await this.redis.sscan(
          SessionRevocationService.KEY,
          cursor,
          "COUNT",
          SessionRevocationService.SCAN_PAGE_SIZE,
        );
        for (const member of members) {
          // Per-member failure defers only that member to the next sweep.
          await this.releaseIfActive(member).catch((error: unknown) =>
            this.observeFailure("reconcile-member", error),
          );
        }
        cursor = next;
      } while (cursor !== "0");
    } catch (error) {
      // SSCAN outage: the whole sweep retries on the next tick.
      this.observeFailure("reconcile", error);
    } finally {
      this.sweepInFlight = false;
    }
  }

  // Releases a member only while its identity row lock is held: FOR NO KEY
  // UPDATE serializes with a concurrent deactivate UPDATE, so the isActive
  // re-read sees the durable state and a racing deactivate cannot slip a
  // commit between our read and the SREM. Inactive and missing users are
  // never released — the DB flag bars them anyway.
  private async releaseIfActive(member: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const exists = await lockUser(tx, member);
      if (!exists) return;
      const user = await tx.user.findUnique({
        where: { id: member },
        select: { isActive: true },
      });
      if (user?.isActive !== true) return;
      try {
        await this.redis.srem(SessionRevocationService.KEY, member);
      } catch (error) {
        // Retryable next sweep; the lock commit is harmless either way.
        this.observeFailure("reconcile-release", error);
      }
    });
  }

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
