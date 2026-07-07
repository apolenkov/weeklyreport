import { Injectable, Logger } from "@nestjs/common";
import { DateTime } from "luxon";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { isUniqueViolation } from "../../lib/prisma-unique-violation.js";

/**
 * The seam that turns ReminderPolicy templates into concrete ReminderRule
 * rows for a given Period (Report).
 *
 * Lifecycle:
 *   - admin.savePeriod creates a Report row → applyToPeriod(report) is
 *     called AFTER the create transaction commits
 *   - prisma/backfill-policy-rules.ts iterates over open periods and
 *     calls applyToPeriod for each, idempotently
 *   - the @Cron scheduler keeps querying ReminderRule directly
 *
 * Validity gate: a policy applies to a period only if
 *   - policy.active === true
 *   - period.deadline >= policy.validFrom
 *   - policy.validUntil === null OR period.deadline <= policy.validUntil
 *
 * Idempotency: applyToPeriod uses upsert against the
 * uq_rule_report_policy unique index. Calling twice is a no-op on the
 * second run; P2002 is caught and logged just in case the unique index
 * is missing in some pre-44-03 environment.
 */
@Injectable()
export class PolicyApplicatorService {
  private readonly logger = new Logger(PolicyApplicatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * DST-correct fireAt math. The deadline is stored as UTC; we shift it
   * into the policy's TZ first so adding `offsetMinutes` (almost always
   * negative, e.g. -1440 for T-24h) lands in the same wall-clock window
   * the lead expects in their local calendar. Then back to UTC for the
   * DB column.
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
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const policies = await this.prisma.reminderPolicy.findMany({
      where: { active: true },
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const policy of policies) {
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
        skipped += 1;
        continue;
      }

      try {
        // Look up existing first so we can report created vs updated;
        // the upsert itself is the source of truth for idempotency.
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

        if (existing) {
          updated += 1;
        } else {
          created += 1;
        }
      } catch (error: unknown) {
        // Unscoped: any P2002 here is the (reportId, policyId) race — the
        // swallow-any behavior this loop has always had.
        if (isUniqueViolation(error)) {
          // Two concurrent applyToPeriod calls raced on the same
          // (reportId, policyId). The unique index prevents duplicates;
          // log + continue so the loop finishes the rest of the
          // policies for this period.
          this.logger.warn(
            `applyToPeriod race on (period=${period.id}, policy=${policy.id}); rule already exists`,
          );
          skipped += 1;
          continue;
        }
        throw error;
      }
    }

    this.logger.log(
      `applyToPeriod period=${period.id}: created=${created} updated=${updated} skipped=${skipped}`,
    );
    return { created, updated, skipped };
  }
}
