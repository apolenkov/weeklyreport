import { MS_PER_DAY } from "@customreport/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type { PrismaClient } from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { AUDIT_LOGGER, type AuditLogger } from "../../../lib/audit-logger.js";
import { SnapshotAdminService } from "../../admin/index.js";
import {
  type AutoCarryOver,
  runAutoCarryOverWithRetry,
} from "../../carry-over/index.js";
import { PolicyApplicatorService } from "../../reminders/index.js";
import type { EnsuredPeriod } from "../application/period-factory.js";
import {
  ensureCurrentPeriod,
  PeriodOverlapError,
} from "../application/period-factory.js";
import { buildTransition } from "../domain/period-transition.js";

// The `report` delegate methods the scheduled→open flip needs.
type FlipReportDelegate = Pick<
  PrismaClient["report"],
  "findMany" | "updateMany"
>;

// Re-asserting `periodState: "scheduled"` in the WHERE makes a concurrent
// lifecycle transition win instead of being overwritten; `buildTransition`
// carries the legacy period tuple alongside the new state in the same write.
export async function flipDueScheduledToOpen(
  report: FlipReportDelegate,
  now: Date,
  logger: Pick<Logger, "log" | "warn">,
): Promise<void> {
  const due = await report.findMany({
    where: { periodState: "scheduled", periodStart: { lte: now } },
    orderBy: [{ periodStart: "asc" }, { id: "asc" }],
    select: { id: true, periodStart: true, periodEnd: true },
  });

  for (const row of due) {
    const { count } = await report.updateMany({
      where: { id: row.id, periodState: "scheduled" },
      data: buildTransition("open", {}),
    });
    if (count === 0) {
      logger.log(
        `scheduled→open skipped period=${row.id}: transitioned away from scheduled by a concurrent writer`,
      );
    }
  }
}

type PeriodTickOutcome =
  | { created: false; reason: "disabled" | "future-period-exists" }
  | {
      created: true;
      periodId: string;
      periodStart: Date;
      periodEnd: Date;
      deadline: Date;
      periodState: "scheduled" | "open";
    };

const FUTURE_PERIOD_EXISTS = "future-period-exists" as const;

export const PERIOD_AUTO_CARRY_OVER = Symbol("PeriodAutoCarryOver");

// `@Cron`, not a repeatable queue job: one write/day sits far below the
// queue/retry/DLQ threshold, and `@nestjs/bullmq` 11 has a DiscoveryService DI
// bug under NestJS 11 the existing processors work around with a raw `Worker`.
@Injectable()
export class PeriodCreatorScheduler {
  private readonly logger = new Logger(PeriodCreatorScheduler.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SnapshotAdminService)
    private readonly snapshotAdminService: SnapshotAdminService,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
    @Inject(PolicyApplicatorService)
    private readonly policyApplicator: PolicyApplicatorService,
    @Inject(PERIOD_AUTO_CARRY_OVER)
    private readonly autoCarryOver: AutoCarryOver,
  ) {}

  // Sweeps every open period, not just rows this tick flipped, so a transiently
  // failed carry is retried; carry follows a period BECOMING open, which
  // `autoCreatePeriods` does not govern. See specs/period-scheduler-wiring.
  private async reconcileCarryOver(): Promise<void> {
    const openPeriods = await this.prisma.report.findMany({
      where: { periodState: "open", periodStatus: "open", archived: false },
      select: { id: true },
    });
    for (const period of openPeriods) {
      await runAutoCarryOverWithRetry(this.autoCarryOver, period.id);
    }
  }

  // 00:05 UTC — the 5-minute offset keeps the tick out of the 00:00 backup
  // window most ops shops run on. Per-timezone firing stays deferred until the
  // settings surface broadens.
  @Cron("5 0 * * *")
  async runDaily(): Promise<void> {
    await this.runOnce(new Date());
  }

  // Test seam: takes `now` so the tick can be driven deterministically, and
  // returns an outcome object so tests need not scrape audit calls.
  async runOnce(now: Date): Promise<PeriodTickOutcome> {
    const settings = await this.snapshotAdminService.getSettings();

    // Periods minted ahead of time on an earlier tick become open here, before
    // any create decision is made against the table.
    await flipDueScheduledToOpen(this.prisma.report, now, this.logger);
    await this.reconcileCarryOver();

    if (!settings.autoCreatePeriods) {
      return { created: false, reason: "disabled" };
    }

    const mostRecent = await this.prisma.report.findFirst({
      orderBy: { periodStart: "desc" },
      select: { id: true, periodEnd: true },
    });

    if (mostRecent && mostRecent.periodEnd.getTime() > now.getTime()) {
      return { created: false, reason: FUTURE_PERIOD_EXISTS };
    }

    // The factory owns deadline math, the lifecycle field set and reminder
    // materialisation, so this path stays identical to the lazy login-create;
    // an empty table falls back to `now` as the anchor.
    const result: EnsuredPeriod | null = await ensureCurrentPeriod(
      this.prisma,
      mostRecent ? new Date(mostRecent.periodEnd.getTime() + MS_PER_DAY) : now,
      now,
      settings,
      this.policyApplicator,
    ).catch((error: unknown): null => {
      if (!(error instanceof PeriodOverlapError)) throw error;
      this.logger.warn(
        "auto-create skipped: the computed period overlaps an existing range",
      );
      return null;
    });

    if (result === null) {
      return { created: false, reason: FUTURE_PERIOD_EXISTS };
    }

    // A concurrent login-create won the boundary; the winning path owns the
    // log and the audit line, so this tick reports the same as a no-op.
    if (!result.created) {
      return { created: false, reason: FUTURE_PERIOD_EXISTS };
    }

    this.logger.log(
      `auto-create period=${result.reportId} state=${result.periodState} (${result.periodStart.toISOString()} → ${result.periodEnd.toISOString()})`,
    );
    // A freshly minted period always carries a deadline; null can only mean
    // schema drift between the factory and this audit call — fail loud.
    if (result.deadline === null) {
      throw new Error("Auto-created period unexpectedly has no deadline.");
    }

    await this.recordAutoCreate(result, result.deadline);

    return {
      created: true,
      periodId: result.reportId,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      deadline: result.deadline,
      periodState: result.periodState,
    };
  }

  private async recordAutoCreate(
    result: EnsuredPeriod,
    deadline: Date,
  ): Promise<void> {
    this.auditLogger.periodAutoCreate({
      periodId: result.reportId,
      periodStart: result.periodStart.toISOString(),
      periodEnd: result.periodEnd.toISOString(),
      deadline: deadline.toISOString(),
      from: null,
      to: result.periodState,
    });

    // A period minted open THIS tick post-dates the reconcile pass above; a
    // scheduled-born one is picked up by a later tick's flip + reconcile.
    if (result.periodState === "open") {
      await runAutoCarryOverWithRetry(this.autoCarryOver, result.reportId);
    }
  }
}
