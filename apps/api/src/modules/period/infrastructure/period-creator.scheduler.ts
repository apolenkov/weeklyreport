import { MS_PER_DAY } from "@customreport/shared";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type { PrismaClient } from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type { AuditLogger } from "../../../lib/audit-logger.js";
import { SnapshotAdminService } from "../../admin/index.js";
import { PolicyApplicatorService } from "../../reminders/index.js";
import type { EnsuredPeriod } from "../application/period-factory.js";
import {
  ensureCurrentPeriod,
  isOpenBoundaryConflict,
} from "../application/period-factory.js";
import { buildTransition } from "../domain/period-transition.js";

/** The `report` delegate methods the scheduled→open flip needs. */
type FlipReportDelegate = Pick<
  PrismaClient["report"],
  "findMany" | "updateMany" | "findFirst"
>;

interface DueScheduledRow {
  readonly id: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
}

// The partial unique boundary index rejected the flip: another row already
// holds this boundary open. Re-read the winner so the log names it, and leave
// the duplicate scheduled row untouched for an operator to reconcile.
async function logBoundaryConflict(
  report: Pick<FlipReportDelegate, "findFirst">,
  row: DueScheduledRow,
  logger: Pick<Logger, "warn">,
): Promise<void> {
  const open = await report.findFirst({
    where: {
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      periodState: "open",
    },
    select: { id: true },
  });
  logger.warn(
    open
      ? `scheduled→open: boundary ${row.periodStart.toISOString()}→${row.periodEnd.toISOString()} already open (period=${open.id}); duplicate scheduled row=${row.id} left in place`
      : `scheduled→open: P2002 on row=${row.id} but no open row found on its boundary; left scheduled for the next tick`,
  );
}

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
    try {
      const { count } = await report.updateMany({
        where: { id: row.id, periodState: "scheduled" },
        data: buildTransition("open", {}),
      });
      if (count === 0) {
        logger.log(
          `scheduled→open skipped period=${row.id}: transitioned away from scheduled by a concurrent writer`,
        );
      }
    } catch (error) {
      if (!isOpenBoundaryConflict(error)) throw error;
      await logBoundaryConflict(report, row, logger);
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

// `@Cron`, not a repeatable queue job: one write/day sits far below the
// queue/retry/DLQ threshold, and `@nestjs/bullmq` 11 has a DiscoveryService DI
// bug under NestJS 11 the existing processors work around with a raw `Worker`.
@Injectable()
export class PeriodCreatorScheduler {
  private readonly logger = new Logger(PeriodCreatorScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotAdminService: SnapshotAdminService,
    private readonly auditLogger: AuditLogger,
    // Wire PolicyApplicator so auto-created periods materialise reminder rules
    // just like admin-panel-created ones.
    private readonly policyApplicator?: PolicyApplicatorService,
    // Auto carry-over hook (best-effort, never rejects), invoked for every
    // fresh-open period each tick. Trailing-optional; the module factory
    // always wires it.
    private readonly autoCarryOver?: (targetReportId: string) => Promise<void>,
  ) {}

  // Sweeps every fresh-open period, not just rows this tick flipped, so a
  // carry that failed transiently earlier is retried. `periodStatus: "open"`
  // excludes reopened periods — a reopen must not re-trigger carry.
  private async reconcileCarryOver(): Promise<void> {
    if (!this.autoCarryOver) return;
    const openPeriods = await this.prisma.report.findMany({
      where: { periodState: "open", periodStatus: "open", archived: false },
      select: { id: true },
    });
    for (const period of openPeriods) {
      await this.autoCarryOver(period.id);
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

    if (!settings.autoCreatePeriods) {
      return { created: false, reason: "disabled" };
    }

    await this.reconcileCarryOver();

    const mostRecent = await this.prisma.report.findFirst({
      orderBy: { periodStart: "desc" },
      select: { id: true, periodEnd: true },
    });

    if (mostRecent && mostRecent.periodEnd.getTime() > now.getTime()) {
      return { created: false, reason: "future-period-exists" };
    }

    // The factory owns deadline math, the lifecycle field set and reminder
    // materialisation, so this path stays identical to the lazy login-create;
    // an empty table falls back to `now` as the anchor.
    const result = await ensureCurrentPeriod(
      this.prisma,
      mostRecent ? new Date(mostRecent.periodEnd.getTime() + MS_PER_DAY) : now,
      now,
      settings,
      this.policyApplicator,
    );

    // A concurrent login-create won the boundary; the winning path owns the
    // log and the audit line, so this tick reports the same as a no-op.
    if (!result.created) {
      return { created: false, reason: "future-period-exists" };
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
    if (result.periodState === "open" && this.autoCarryOver) {
      await this.autoCarryOver(result.reportId);
    }
  }
}
