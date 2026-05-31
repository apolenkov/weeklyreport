import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { AuditLogger } from "../../lib/audit-logger.js";
import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { computeDeadline } from "../../lib/business-date.js";
import type { AdminService } from "../admin/admin.service";
import { getCurrentWeekBounds } from "../auth/auth.routes.js";
import type { PolicyApplicatorService } from "../reminders/policy-applicator.service.js";
import { buildTransition, initialPeriodState } from "./period-transition.js";

/**
 * UFB-049 / Phase 50-B: daily scheduler that creates the next Period when
 * the most recent one is in the past and `AppSettings.autoCreatePeriods=true`.
 *
 * Pattern mirrors {@link RemindersScheduler}: a `runOnce(now)` test seam plus
 * a thin `@Cron` wrapper that supplies `new Date()`. We chose `@Cron` over
 * BullMQ repeatable jobs because (a) the workload is one DB write per day —
 * far below the queue/retry/DLQ threshold; (b) the codebase already has the
 * `@Cron` idiom (`RemindersScheduler`); (c) `@nestjs/bullmq` 11 has a
 * documented DiscoveryService DI bug under NestJS 11 that the existing
 * processors explicitly work around with raw `Worker`.
 *
 * Idempotency: the scheduler skips when a future Period (periodEnd > now)
 * already exists, so two ticks within the same day collapse to a single
 * Period without DB constraint races.
 *
 * Cron: fires daily at 00:05 (UTC for now; per-tz Cron is deferred to
 * Phase 51-A which broadens the settings surface). The 5-minute offset
 * avoids midnight crowding with backup/maintenance jobs.
 */
@Injectable()
export class PeriodCreatorScheduler {
  private readonly logger = new Logger(PeriodCreatorScheduler.name);
  private readonly auditLogger: AuditLogger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
    auditLogger?: AuditLogger,
    // TD-06: wire PolicyApplicator so auto-created periods materialise
    // reminder rules just like admin-panel-created ones.
    private readonly policyApplicator?: PolicyApplicatorService,
  ) {
    this.auditLogger = auditLogger ?? createNullAuditLogger();
  }

  // Every day at 00:05 UTC. The 5-minute offset keeps the tick out of the
  // 00:00 backup window most ops shops run on.
  @Cron("5 0 * * *")
  async runDaily(): Promise<void> {
    await this.runOnce(new Date());
  }

  /**
   * Scheduler-internal entry point exposed for unit tests so we can drive
   * the tick deterministically with a stubbed `now`. Returns a small
   * outcome object so tests don't have to scrape audit calls.
   */
  async runOnce(now: Date): Promise<
    | { created: false; reason: "disabled" | "future-period-exists" }
    | {
        created: true;
        periodId: string;
        periodStart: Date;
        periodEnd: Date;
        deadline: Date;
        periodState: "scheduled" | "open";
      }
  > {
    const settings = await this.adminService.getSettings();
    if (!settings.autoCreatePeriods) {
      return { created: false, reason: "disabled" };
    }

    // UFB-053 / Phase 51-C: before creating, flip any 'scheduled' rows
    // whose periodStart has been reached to 'open'. This is the
    // SCHEDULED→OPEN transition for periods minted ahead-of-time on a
    // previous tick. We keep the write narrow (just `periodState`) — the
    // legacy `status` tuple was already (`draft`, `archived=false`) at
    // SCHEDULED-time and stays that way at OPEN-time.
    await this.prisma.report.updateMany({
      where: { periodState: "scheduled", periodStart: { lte: now } },
      // refactor-period-transition-writer: the open transition supplies the
      // full field set (periodState='open' + the draft/false legacy tuple the
      // scheduled rows already carry, so it is a no-op on those columns).
      data: buildTransition("open", {}),
    });

    // Most recent period across the whole table. If it ends in the future
    // (or right now), nothing to do — the current cycle is still open.
    const mostRecent = await this.prisma.report.findFirst({
      orderBy: { periodStart: "desc" },
      select: { id: true, periodEnd: true },
    });

    if (mostRecent && mostRecent.periodEnd.getTime() > now.getTime()) {
      return { created: false, reason: "future-period-exists" };
    }

    // Anchor the next period to "next Monday" (or current week's Monday if
    // we are still inside it — defensive against a no-period DB).
    const { periodStart, periodEnd } = getCurrentWeekBounds(
      mostRecent
        ? new Date(mostRecent.periodEnd.getTime() + 24 * 3_600_000)
        : now,
      settings.periodLengthDays,
    );

    const deadline = computeDeadline(
      periodStart,
      settings.defaultDeadlineDays,
      settings.workingDays,
      settings.defaultTimezone,
      18,
    );

    // UFB-053: choose the initial state based on whether the period's
    // start has been reached. The 'open' branch matches the pre-51-C
    // behaviour; the 'scheduled' branch lights up only when the cron
    // tick mints a period ahead of its start day (a rare-but-possible
    // path once cadence-aware creation lands in a future plan).
    const periodState = initialPeriodState(periodStart, now);

    const created = await this.prisma.report.create({
      // refactor-period-transition-writer: identity envelope + lifecycle field
      // set from the transition builder. The resolved scheduled|open state
      // maps to the schedule/open kind (both a draft/false legacy tuple); the
      // narrow `periodState` local is kept for the audit/log/return below.
      data: {
        periodStart,
        periodEnd,
        deadline,
        ...buildTransition(
          periodState === "scheduled" ? "schedule" : "open",
          {},
        ),
      },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        deadline: true,
        periodState: true,
      },
    });

    // TD-06: materialise reminder rules for the new period, mirroring the
    // admin.prisma-repository path. Optional so tests that don't care about
    // reminder wiring still pass without a full policyApplicator mock.
    await this.policyApplicator?.applyToPeriod(created);

    this.logger.log(
      `auto-create period=${created.id} state=${created.periodState} (${created.periodStart.toISOString()} → ${created.periodEnd.toISOString()})`,
    );
    this.auditLogger.periodAutoCreate({
      periodId: created.id,
      periodStart: created.periodStart.toISOString(),
      periodEnd: created.periodEnd.toISOString(),
      deadline: created.deadline.toISOString(),
      from: null,
      to: created.periodState,
    });

    return {
      created: true,
      periodId: created.id,
      periodStart: created.periodStart,
      periodEnd: created.periodEnd,
      deadline: created.deadline,
      // The DB column is typed as the wider PeriodState union, but a
      // freshly-created period can only land in 'scheduled' or 'open'
      // (the creator never mints a published or archived row). We narrow
      // back to the original initialPeriodState() value to keep the
      // public return shape precise.
      periodState,
    };
  }
}
