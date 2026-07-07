import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { publishCompareAndSet } from "../../../lib/publish-compare-and-set.js";
import { AdminPeriodOverlapError } from "../../admin/admin-shared.js";
import {
  buildAssembledReportFromPrismaRow,
  reportFullIncludeForSnapshot,
  toPublishedSnapshotJson,
} from "../../published-report-snapshot.js";
import { WeeklyReportPrismaRepository } from "../../weekly-report/weekly-report.prisma-repository.js";
import type {
  PeriodRepository,
  PublishPeriodOutcome,
} from "../application/period.service.js";
import { isOpenBoundaryConflict } from "../application/period-factory.js";
import { applyTransition } from "../application/period-transition.apply.js";
import { buildTransition } from "../domain/period-transition.js";

@Injectable()
export class PeriodPrismaRepository implements PeriodRepository {
  constructor(
    private readonly prisma: PrismaService,
    // The lifecycle resolvers live once in the weekly-report repository (the
    // canonical home of getCurrentEditableId). Delegating to it keeps the head's
    // authz target and the weekly-report default in lock-step — no second copy.
    private readonly weeklyReportRepository: WeeklyReportPrismaRepository,
  ) {}

  async getReportById(reportId: string): Promise<{
    id: string;
    status: string;
    periodStatus: string;
    publishedAt: Date | null;
    archived: boolean;
  } | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        status: true,
        periodStatus: true,
        publishedAt: true,
        archived: true,
      },
    });

    return report;
  }

  getCurrentEditableId(): Promise<string | null> {
    return this.weeklyReportRepository.getCurrentEditableId();
  }

  getLatestPublishedNonArchivedId(): Promise<string | null> {
    return this.weeklyReportRepository.getLatestPublishedNonArchivedId();
  }

  async getReopenedNonArchivedId(): Promise<string | null> {
    // A reopened period keeps the legacy tuple (status='published',
    // archived=false) but flips periodStatus to 'reopened' (period-transition
    // `reopen`). Match on that canonical marker. The deterministic ordering is
    // not load-bearing — the single-active-reopen guard only needs to know one
    // exists — but mirrors the other resolvers for a stable pick.
    const reopened = await this.prisma.report.findFirst({
      where: { periodStatus: "reopened", archived: false },
      orderBy: [{ periodStart: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    return reopened?.id ?? null;
  }

  async publishPeriod(
    reportId: string,
    userId: string,
  ): Promise<PublishPeriodOutcome> {
    return this.prisma.$transaction(async (tx) => {
      // Shared compare-and-set: only a not-yet-published, non-archived period
      // transitions, and a zero-row match is disambiguated (raced vs archived)
      // by a re-read through this same `tx`. The complete publish field set
      // comes from the transition builder (preserving the single
      // transition-writer invariant); the snapshot is written as a second
      // statement inside this transaction below, so state + snapshot stay atomic.
      const outcome = await publishCompareAndSet(
        tx,
        reportId,
        buildTransition("publish", { now: new Date(), userId }),
      );

      if (outcome !== "transitioned") {
        return { transitioned: false, reason: outcome };
      }

      // updateMany cannot carry an `include`, so read the row back to build the
      // snapshot — still inside this transaction, so it stays atomic with the
      // transition.
      const published = await tx.report.findUniqueOrThrow({
        where: { id: reportId },
        include: reportFullIncludeForSnapshot,
      });
      const snapshot = buildAssembledReportFromPrismaRow(published);
      await tx.report.update({
        where: { id: reportId },
        data: {
          publishedSnapshot: toPublishedSnapshotJson(snapshot),
        },
      });

      return { transitioned: true };
    });
  }

  /**
   * All section ids for a report. Read by the post-publish ingestion seam
   * (see `IngestionPublishHook`) so a future async consumer can enqueue
   * per-section work after `publishPeriod` resolves. Returns an empty
   * array when the report has no sections (legal — period was published
   * without anyone filling in their section).
   */
  async listSectionIds(reportId: string): Promise<string[]> {
    const sections = await this.prisma.reportSection.findMany({
      where: { reportId },
      select: { id: true },
    });
    return sections.map((s) => s.id);
  }

  async reopenPeriod(reportId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // refactor-period-transition-writer: the reopen transition encodes the
        // intentional asymmetry (periodState→'open', periodStatus→'reopened',
        // legacy tuple untouched) and stamps reopenedAt. See period-transition.ts.
        await applyTransition(tx, reportId, "reopen", { now: new Date() });

        await tx.reportSection.updateMany({
          where: {
            reportId,
            status: "submitted",
          },
          data: {
            status: "draft",
            submittedAt: null,
          },
        });
      });
    } catch (error) {
      // Reopen moves the row to periodState='open'; if another open period
      // already holds this boundary the partial unique index rejects it.
      // Surface the same friendly overlap error as the admin create/update
      // paths (→ BAD_REQUEST), never a 500. Any other error re-throws.
      if (isOpenBoundaryConflict(error)) {
        throw new AdminPeriodOverlapError(
          "A period already exists for these dates.",
        );
      }
      throw error;
    }
  }
}
