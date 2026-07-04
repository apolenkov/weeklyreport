import { MS_PER_DAY } from "@customreport/shared";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type { PrismaClient } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { AuditLogger } from "../../lib/audit-logger.js";
import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { AdminService } from "../admin/admin.service";
import { PolicyApplicatorService } from "../reminders/policy-applicator.service.js";
import {
  ensureCurrentPeriod,
  isOpenBoundaryConflict,
} from "./period-factory.js";
import { buildTransition } from "./period-transition.js";

/** The `report` delegate methods the scheduled→open flip needs. */
type FlipReportDelegate = Pick<
  PrismaClient["report"],
  "findMany" | "update" | "findFirst"
>;

/**
 * Flip every due `scheduled` row (its `periodStart` has been reached) to
 * `open`, ONE ROW AT A TIME in a deterministic `(periodStart, id)` order. The
 * partial unique index `Report_one_open_per_boundary` constrains this UPDATE,
 * so a row whose boundary another writer already opened — or a sibling
 * scheduled row that this loop opened a moment earlier — raises `P2002`.
 * Processing sequentially makes recovery a single rule: the first row on a
 * boundary commits open, and any later row that collides re-reads, finds the
 * now-open row, and is left scheduled (never deleted) and logged. So exactly
 * one row per boundary opens and the boundary is never left without an open
 * period. A non-`P2002` error aborts the tick (re-thrown unchanged).
 */
export async function flipDueScheduledToOpen(
  report: FlipReportDelegate,
  now: Date,
  logger: Pick<Logger, "warn">,
): Promise<void> {
  const due = await report.findMany({
    where: { periodState: "scheduled", periodStart: { lte: now } },
    orderBy: [{ periodStart: "asc" }, { id: "asc" }],
    select: { id: true, periodStart: true, periodEnd: true },
  });

  for (const row of due) {
    try {
      // refactor-period-transition-writer: the open transition writes the full
      // field set (periodState='open' + the draft/false legacy tuple the
      // scheduled row already carries).
      await report.update({
        where: { id: row.id },
        data: buildTransition("open", {}),
      });
    } catch (error) {
      if (!isOpenBoundaryConflict(error)) throw error;

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
  }
}

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
    // Auto carry-over hook (best-effort, never rejects), invoked for every
    // fresh-open period each tick. Optional for the same DI reason as the
    // audit logger; the module factory always wires it.
    private readonly autoCarryOver?: (targetReportId: string) => Promise<void>,
  ) {
    this.auditLogger = auditLogger ?? createNullAuditLogger();
  }

  /**
   * Reconcile carry-over for EVERY fresh-open period, not only rows this tick
   * flipped: `flipDueScheduledToOpen` can open several rows at once, and a
   * period whose carry failed transiently on a previous tick gets retried
   * here (the execution dedupe inside the orchestrator makes a re-visit a
   * single indexed read). `periodStatus: "open"` deliberately excludes
   * reopened periods — a reopen amends a published period and must not
   * re-trigger carry.
   */
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

    // UFB-053 / Phase 51-C: before creating, flip any 'scheduled' rows whose
    // periodStart has been reached to 'open' (the SCHEDULED→OPEN transition for
    // periods minted ahead-of-time on a previous tick). period-uniqueness: the
    // partial unique index now constrains this UPDATE, so the flip runs
    // per-boundary with P2002 recovery instead of a single bulk updateMany.
    await flipDueScheduledToOpen(this.prisma.report, now, this.logger);

    await this.reconcileCarryOver();

    // Most recent period across the whole table. If it ends in the future
    // (or right now), nothing to do — the current cycle is still open.
    const mostRecent = await this.prisma.report.findFirst({
      orderBy: { periodStart: "desc" },
      select: { id: true, periodEnd: true },
    });

    if (mostRecent && mostRecent.periodEnd.getTime() > now.getTime()) {
      return { created: false, reason: "future-period-exists" };
    }

    // refactor-auth-exemplary-layering: route the create through the single
    // period factory so deadline math, the lifecycle field set, and reminder
    // materialisation match the lazy login-create path exactly. The factory
    // anchors the next cycle to the day after the most recent period's end
    // (or `now` when the table is empty — defensive against a no-period DB),
    // computes the deadline, applies reminder policy on create, and is
    // race-safe against a concurrent login-create.
    const anchorDate = mostRecent
      ? new Date(mostRecent.periodEnd.getTime() + MS_PER_DAY)
      : now;

    const result = await ensureCurrentPeriod(
      this.prisma,
      anchorDate,
      now,
      settings,
      this.policyApplicator,
    );

    if (!result.created) {
      // A concurrent login-create won the boundary; the period now exists, so
      // this tick has nothing to mint. Same outcome as a pre-existing future
      // period — no log, no audit (the winning path owns those).
      return { created: false, reason: "future-period-exists" };
    }

    this.logger.log(
      `auto-create period=${result.reportId} state=${result.periodState} (${result.periodStart.toISOString()} → ${result.periodEnd.toISOString()})`,
    );
    this.auditLogger.periodAutoCreate({
      periodId: result.reportId,
      periodStart: result.periodStart.toISOString(),
      periodEnd: result.periodEnd.toISOString(),
      deadline: result.deadline.toISOString(),
      from: null,
      to: result.periodState,
    });

    // A period minted open THIS tick post-dates the reconcile pass above; a
    // scheduled-born one is picked up by a later tick's flip + reconcile.
    if (result.periodState === "open" && this.autoCarryOver) {
      await this.autoCarryOver(result.reportId);
    }

    return {
      created: true,
      periodId: result.reportId,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      deadline: result.deadline,
      periodState: result.periodState,
    };
  }
}
