import { Injectable, Logger } from "@nestjs/common";
import type { ReminderPolicy } from "@prisma/client";
import { DateTime } from "luxon";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { isUniqueViolation } from "../../lib/prisma-unique-violation.js";

/** Outcome of applying one policy to one period — see {@link PolicyApplicatorService.applyToPeriod}. */
type PolicyApplyOutcome = "created" | "skipped" | "updated";
type PolicyApplyTally = Record<PolicyApplyOutcome, number>;

/**
 * The seam that turns ReminderPolicy templates into concrete ReminderRule
 * rows for a given Period (Report).
 *
 * Lifecycle:
 *   - admin.savePeriod creates a Report row → applyToPeriod(report) is
 *     called AFTER the create transaction commits
 *   - prisma/backfill-policy-rules.ts iterates over open periods with its
 *     own inline upsert (it cannot import this service — isolated prisma
 *     tsconfig) applying the same validity gate and fireAt math
 *   - the @Cron scheduler keeps querying ReminderRule directly
 *
 * Validity gate: a policy applies to a period only if
 *   - policy.active === true
 *   - period.deadline >= policy.validFrom
 *   - policy.validUntil === null OR period.deadline <= policy.validUntil
 *
 * Idempotency: applyToPeriod uses upsert against the
 * uq_rule_report_policy unique index. Calling twice is a no-op on the
 * second run; P2002 is caught and logged in case an older database is
 * missing the unique index.
 */
@Injectable()
export class PolicyApplicatorService {
  private readonly logger = new Logger(PolicyApplicatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * fireAt math. The deadline is stored as UTC; we shift it into the policy's
   * zone, add `offsetMinutes` (almost always negative, e.g. -1440 for T-24h)
   * as an exact-duration span on that zoned instant, then convert back to UTC
   * for the DB column. This is precise-minute arithmetic, not calendar
   * wall-clock preservation: an offset that straddles a DST transition lands
   * `offsetMinutes` of real elapsed time from the deadline, so the local
   * wall-clock hour can shift by the DST delta.
   *
   * Kept in sync BY HAND with prisma/backfill-policy-rules.ts's computeFireAt:
   * the prisma toolchain's isolated tsconfig cannot import this service.
   */
  computeFireAt(deadline: Date, offsetMinutes: number, tz: string): Date {
    return DateTime.fromJSDate(deadline, { zone: "utc" })
      .setZone(tz)
      .plus({ minutes: offsetMinutes })
      .toUTC()
      .toJSDate();
  }

  /**
   * Validity-window gate. Centralized so the unit test and the
   * applicator and the backfill use the exact same boolean.
   */
  static policyAppliesTo(
    policy: {
      active: boolean;
      validFrom: Date;
      validUntil: Date | null;
    },
    period: { deadline: Date },
  ): boolean {
    if (!policy.active) return false;
    if (period.deadline.getTime() < policy.validFrom.getTime()) return false;
    if (
      policy.validUntil !== null &&
      period.deadline.getTime() > policy.validUntil.getTime()
    ) {
      return false;
    }
    return true;
  }

  /**
   * Attach one ReminderRule per active policy whose validity window
   * covers period.deadline. Policies that fail the gate produce zero
   * rules. Idempotent: second call is a no-op (upsert by
   * uq_rule_report_policy).
   *
   * When `now` is supplied, a rule whose computed `fireAt` is already in the
   * past is skipped rather than materialised as `active`. The reminders
   * scheduler fires any active rule with `fireAt <= now` (no elapsed-fireAt
   * lower bound), so creating an already-past active rule would dispatch a
   * stale reminder on the next tick. This matters for the login-time period
   * factory, which can create a period AFTER some of its reminder instants have
   * passed (a late first-login): the still-future instants (e.g. a T+2h
   * escalation) are kept, only the elapsed ones are dropped. Callers that mint
   * periods strictly ahead of their reminders (the cron scheduler) omit `now`
   * and are unaffected.
   */
  async applyToPeriod(
    period: {
      id: string;
      deadline: Date;
    },
    now?: Date,
    excludePolicyIds?: ReadonlySet<string>,
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const policies = await this.prisma.reminderPolicy.findMany({
      where: { active: true },
    });

    const tally = await this.collectPolicyTally(
      policies,
      period,
      now,
      excludePolicyIds,
    );

    this.logger.log(
      `applyToPeriod period=${period.id}: created=${tally.created} updated=${tally.updated} skipped=${tally.skipped}`,
    );
    return tally;
  }

  // Sequential: each policy's findUnique-then-upsert must finish before the next
  // so P2002 recovery cannot interleave with a sibling write.
  private async collectPolicyTally(
    remaining: readonly ReminderPolicy[],
    period: { id: string; deadline: Date },
    now: Date | undefined,
    excludePolicyIds: ReadonlySet<string> | undefined,
  ): Promise<PolicyApplyTally> {
    return remaining.reduce<Promise<PolicyApplyTally>>(
      async (tallyPromise, policy) => {
        const tally = await tallyPromise;
        const outcome = await this.applyPolicyToPeriod(
          policy,
          period,
          now,
          excludePolicyIds,
        );
        return { ...tally, [outcome]: tally[outcome] + 1 };
      },
      Promise.resolve({ created: 0, skipped: 0, updated: 0 }),
    );
  }

  // Validity/elapsed gate then upsert; concurrent P2002 races report as "skipped".
  private async applyPolicyToPeriod(
    policy: ReminderPolicy,
    period: { id: string; deadline: Date },
    now: Date | undefined,
    excludePolicyIds: ReadonlySet<string> | undefined,
  ): Promise<PolicyApplyOutcome> {
    // Snapshot restore passes the pairs its own transaction just wrote:
    // re-materializing those would clobber the restored rows' status and
    // fireAt (e.g. force a deliberately paused rule back to active).
    if (excludePolicyIds?.has(policy.id)) {
      return "skipped";
    }
    const fireAt = this.computeFireAt(
      period.deadline,
      policy.offsetMinutes,
      policy.timezone,
    );
    // Skip a policy outside its validity window, or — when `now` is given —
    // one whose instant has already elapsed (it would fire stale, since the
    // scheduler has no elapsed-fireAt lower bound). One gate, one skip path.
    const elapsed = now !== undefined && fireAt.getTime() <= now.getTime();
    if (!PolicyApplicatorService.policyAppliesTo(policy, period) || elapsed) {
      return "skipped";
    }
    return this.upsertRuleForPolicy(policy, period, fireAt);
  }

  // findUnique runs before the upsert purely so the tally can distinguish
  // created from updated; both share one try so a concurrent P2002 from either
  // is recovered as "skipped".
  private async upsertRuleForPolicy(
    policy: ReminderPolicy,
    period: { id: string; deadline: Date },
    fireAt: Date,
  ): Promise<PolicyApplyOutcome> {
    try {
      const existing = await this.prisma.reminderRule.findUnique({
        where: {
          reportId_policyId: { reportId: period.id, policyId: policy.id },
        },
        select: { id: true },
      });

      await this.prisma.reminderRule.upsert({
        where: {
          reportId_policyId: { reportId: period.id, policyId: policy.id },
        },
        create: {
          reportId: period.id,
          policyId: policy.id,
          fireAt,
          kind: policy.kind,
          timezone: policy.timezone,
          status: "active",
        },
        update: {
          fireAt,
          kind: policy.kind,
          timezone: policy.timezone,
          status: "active",
        },
      });

      return existing ? "updated" : "created";
    } catch (error: unknown) {
      // Concurrent applyToPeriod on the same (reportId, policyId): log and continue.
      if (isUniqueViolation(error)) {
        this.logger.warn(
          `applyToPeriod race on (period=${period.id}, policy=${policy.id}); rule already exists`,
        );
        return "skipped";
      }
      throw error;
    }
  }
}
