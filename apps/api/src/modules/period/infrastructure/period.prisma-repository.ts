import { currentPeriodLifecycleSchema } from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { AdminPeriodOverlapError } from "../../admin/index.js";
import {
  lockAllReminderPolicies,
  pauseReminderRulesForReport,
  synchronizeReminderRulesForReport,
} from "../../reminders/index.js";
import {
  buildAssembledReportFromPrismaRow,
  reportFullIncludeForSnapshot,
  toPublishedSnapshotJson,
} from "../../report-sections/index.js";
import { freezePublishedSnapshot } from "../../search/index.js";
import {
  WEEKLY_REPORT_LIFECYCLE,
  type WeeklyReportLifecyclePort,
} from "../../weekly-report/index.js";
import {
  PeriodAccessError,
  type PeriodRepository,
  PeriodScopeError,
  PeriodStaleStateError,
  type PublishPeriodOutcome,
} from "../application/period.service.js";
import {
  isPeriodOverlapConflict,
  PeriodLifecycleIntegrityError,
} from "../application/period-factory.js";
import type { PeriodLifecycleExpectation } from "../domain/period-lifecycle-expectation.js";
import { buildTransition } from "../domain/period-transition.js";
import { publishCompareAndSet } from "./publish-compare-and-set.js";
import { reopenCompareAndSet } from "./reopen-compare-and-set.js";

@Injectable()
export class PeriodPrismaRepository implements PeriodRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    // The lifecycle resolvers live once in the weekly-report repository (the
    // canonical home of getCurrentEditableId). Delegating to it keeps the head's
    // authz target and the weekly-report default in lock-step — no second copy.
    @Inject(WEEKLY_REPORT_LIFECYCLE)
    private readonly weeklyReportRepository: WeeklyReportLifecyclePort,
  ) {}

  async getReportById(
    reportId: string,
  ): Promise<(PeriodLifecycleExpectation & { readonly id: string }) | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        periodState: true,
        periodStatus: true,
        archived: true,
        autoPublished: true,
        autoArchived: true,
        publishedAt: true,
        publishedById: true,
        reopenedAt: true,
      },
    });

    if (!report) return null;
    const lifecycle = currentPeriodLifecycleSchema.safeParse(report);
    if (!lifecycle.success) throw new PeriodLifecycleIntegrityError();
    return {
      id: report.id,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      ...lifecycle.data,
    };
  }

  getCurrentEditableId(): Promise<string | null> {
    return this.weeklyReportRepository.getCurrentEditableId();
  }

  getLatestPublishedNonArchivedId(): Promise<string | null> {
    return this.weeklyReportRepository.getLatestPublishedNonArchivedId();
  }

  async getReopenedNonArchivedId(): Promise<string | null> {
    // periodStatus='reopened' is the canonical reopen marker (status stays published).
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
    expected: PeriodLifecycleExpectation,
  ): Promise<PublishPeriodOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const publishAt = new Date();
      await lockAllReminderPolicies(tx);
      // The publishedSnapshot check requires the guarded write itself to carry
      // the prospective published metadata. Build that provisional snapshot
      // from the same timestamp and publisher as the CAS; the post-CAS read
      // below replaces it with the exact state that won the transition. Under
      // READ COMMITTED, each statement sees the latest committed row, and the
      // CAS holds the row lock until commit, so the second read cannot observe
      // a torn publication.
      const candidate = await tx.report.findUnique({
        where: { id: reportId },
        include: reportFullIncludeForSnapshot,
      });
      const publisher = candidate
        ? await tx.user.findUnique({ where: { id: userId } })
        : null;

      const provisionalSnapshot = candidate
        ? toPublishedSnapshotJson(
            buildAssembledReportFromPrismaRow({
              ...candidate,
              status: "published",
              publishedAt: publishAt,
              publishedById: userId,
              publishedBy: publisher,
            }),
          )
        : {};

      const outcome = await publishCompareAndSet(tx, reportId, expected, {
        ...buildTransition("publish", { now: publishAt, userId }),
        publishedSnapshot: provisionalSnapshot,
      });

      if (outcome !== "transitioned") {
        return { transitioned: false, reason: outcome };
      }

      const submittedSections = await tx.reportSection.count({
        where: { reportId, status: "submitted" },
      });
      if (submittedSections === 0) {
        throw new PeriodAccessError(
          "At least one section must be submitted before publishing.",
        );
      }

      await pauseReminderRulesForReport(tx, reportId);

      // updateMany cannot carry an `include`, so re-read and replace the
      // provisional snapshot inside this transaction to stay atomic.
      await freezePublishedSnapshot(tx, reportId);

      return { transitioned: true };
    });
  }

  async reopenPeriod(
    reportId: string,
    expected: PeriodLifecycleExpectation,
  ): Promise<void> {
    const reopenedAt = new Date();
    try {
      await this.prisma.$transaction(async (tx) => {
        const policies = await lockAllReminderPolicies(tx);
        // Full expected lifecycle + boundaries close reopen races against any
        // competing lifecycle or reporting-window change.
        const outcome = await reopenCompareAndSet(
          tx,
          reportId,
          expected,
          buildTransition("reopen", { now: reopenedAt }),
        );

        if (outcome !== "transitioned") {
          // Distinguish a stale expected tuple from an ineligible lifecycle.
          if (outcome === "stale") {
            throw new PeriodStaleStateError(
              "The period changed while it was being reopened. Reload and retry.",
            );
          }
          throw new PeriodScopeError(
            outcome === "archived"
              ? "Archived periods cannot be reopened."
              : "Only published periods can be reopened.",
          );
        }

        // Only the winning reopen resets submitted sections, same tx.
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
        await synchronizeReminderRulesForReport(
          tx,
          policies,
          reportId,
          reopenedAt,
        );
      });
    } catch (error) {
      // Translate a period-range overlap into the domain error.
      if (isPeriodOverlapConflict(error)) {
        throw new AdminPeriodOverlapError(
          "A period already exists for these dates.",
        );
      }
      throw error;
    }
  }
}
