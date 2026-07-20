import {
  type PeriodStatus,
  type ReportSectionReadModel,
  type ReportStatus,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { isUniqueViolation } from "../../../lib/prisma-unique-violation.js";
import {
  ReportSectionDomainError,
  type ReportSectionsRepository,
  SectionVersionConflictError,
} from "../application/report-sections.service";
import type { MyHistorySectionRow } from "../domain/my-history.js";
import { queryPublishedLineage } from "./published-lineage.query.js";
import { reportSectionFullInclude } from "./report-sections.include";
import { mapPrismaToReportSection } from "./report-sections.mappers";
import { queryMyHistoryRows } from "./report-sections.my-history-query.js";
import {
  captureRecordComments,
  reinsertRecordComments,
} from "./report-sections.save-lineage";

@Injectable()
export class ReportSectionsPrismaRepository implements ReportSectionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Canonical period status of the section's report, keyed on the section id —
   * the single lookup both write-path gates read. Selects `report.periodStatus`
   * so the reopen-editable states (`open` / `reopened`) are distinguished from
   * the legacy `Report.status` column, which reopen leaves at `published`.
   */
  async getReportPeriodStatusForSection(
    sectionId: string,
  ): Promise<PeriodStatus | null> {
    const row = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      select: { report: { select: { periodStatus: true } } },
    });
    return row?.report.periodStatus ?? null;
  }

  /**
   * Deadline-aware report lookup used by the submitSection grace-period gate.
   * Returns null when the report does not exist so the service can no-op the
   * gate without ad-hoc try/catch.
   */
  async getReportMeta(
    reportId: string,
  ): Promise<{ status: ReportStatus; deadline: Date } | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { status: true, deadline: true },
    });

    return report ?? null;
  }

  async getSectionById(
    reportSectionId: string,
  ): Promise<ReportSectionReadModel | null> {
    const row = await this.prisma.reportSection.findUnique({
      where: { id: reportSectionId },
      include: reportSectionFullInclude,
    });

    if (!row) {
      return null;
    }

    return mapPrismaToReportSection(row);
  }

  /**
   * Published lineage of the section's CURRENT rows (items + decisions) — the
   * resolve-not-delete lock's reference set. Delegates to
   * `queryPublishedLineage`, which unions the own report's frozen
   * `publishedSnapshot` (the reopened-period case) with live rows in other
   * frozen published/archived reports (the carried-clone case).
   */
  getPublishedLineage(section: ReportSectionReadModel): Promise<{
    itemStableIds: readonly string[];
    decisionStableIds: readonly string[];
  }> {
    return queryPublishedLineage(this.prisma, {
      reportId: section.reportId,
      reportSectionId: section.reportSectionId,
      itemStableIds: section.items.flatMap((item) =>
        item.stableId ? [item.stableId] : [],
      ),
      decisionStableIds: section.decisions.flatMap((decision) =>
        decision.stableId ? [decision.stableId] : [],
      ),
    });
  }

  async saveSection(
    section: ReportSectionReadModel,
    expectedVersion: number,
  ): Promise<ReportSectionReadModel> {
    const sectionId = section.reportSectionId;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Publish/save mutual exclusion: lock the parent report row FIRST
          // (same lock order as the publish transaction, which updates Report
          // before reading sections — consistent ordering, no deadlock). A
          // concurrent publish either committed already (this locking read
          // then sees periodStatus="published" and the save fails closed
          // before any child delete runs) or blocks on this row lock until
          // the save commits — so a snapshot freeze can never interleave a
          // half-saved section, and a published report's live rows can never
          // be rewritten by a save whose service-level gate read a stale
          // status.
          const gate = await tx.$queryRaw<
            { periodStatus: string }[]
          >`SELECT "periodStatus" FROM "Report" WHERE "id" = ${section.reportId} FOR UPDATE`;
          if (
            gate[0]?.periodStatus !== "open" &&
            gate[0]?.periodStatus !== "reopened"
          ) {
            throw new ReportSectionDomainError(
              "SECTION_ALREADY_SUBMITTED",
              "Cannot edit sections of a published report.",
            );
          }

          // Optimistic-concurrency compare-and-set, FIRST so a conflict aborts
          // before any deleteMany runs (no child rows are touched on conflict).
          // `expectedVersion` is the client-loaded version threaded through the
          // payload — NOT the freshly-fetched row's — so a stale writer whose
          // row was advanced concurrently matches zero rows and 409s.
          const updated = await tx.reportSection.updateMany({
            where: { id: sectionId, version: expectedVersion },
            data: {
              status: section.status,
              submittedAt: section.submittedAt,
              // Persist the late flag computed by submitSection; saveDraft /
              // reopen paths carry the prior value through mergeSection.
              late: section.late,
              version: { increment: 1 },
            },
          });
          if (updated.count === 0) {
            throw new SectionVersionConflictError(
              "This section was changed by another save. Reload and try again.",
            );
          }

          // review-acknowledgement (comment-aware save): lift reviewer comments
          // out before the child delete-recreate cascades them away, keyed by
          // the record's durable lineage (stableId + kind), then re-anchor the
          // survivors below. A comment whose record is dropped from this payload
          // is NOT re-inserted → it hard-dies with the record it flagged.
          const capturedComments = await captureRecordComments(tx, sectionId);

          await tx.projectStatus.deleteMany({
            where: { reportSectionId: sectionId },
          });
          await tx.stageStatus.deleteMany({
            where: { reportSectionId: sectionId },
          });
          await tx.activityStatus.deleteMany({
            where: { reportSectionId: sectionId },
          });
          await tx.item.deleteMany({ where: { reportSectionId: sectionId } });
          await tx.risk.deleteMany({ where: { reportSectionId: sectionId } });
          await tx.decision.deleteMany({
            where: { reportSectionId: sectionId },
          });

          const projectData = section.projects.map((p) => ({
            reportSectionId: sectionId,
            projectId: p.projectId,
            status: p.trafficLight,
          }));

          if (projectData.length > 0) {
            await tx.projectStatus.createMany({ data: projectData });
          }

          const stageStatusData = section.projects.flatMap((project) =>
            (project.ownedStages ?? []).map((stage) => ({
              reportSectionId: sectionId,
              projectId: project.projectId,
              stageId: stage.stageId,
              status: stage.status ?? null,
            })),
          );

          if (stageStatusData.length > 0) {
            await tx.stageStatus.createMany({ data: stageStatusData });
          }

          // Mirror ProjectStatus: recreate the activity slice from the merged
          // read model. Every id here came from the seeded server-side set —
          // mergeSection folds client statuses onto section.activities and the
          // service rejects any unattached activityId before this runs.
          const activityStatusData = section.activities.map((activity) => ({
            reportSectionId: sectionId,
            activityId: activity.activityId,
            status: activity.status,
            note: activity.note ?? null,
          }));

          if (activityStatusData.length > 0) {
            await tx.activityStatus.createMany({ data: activityStatusData });
          }

          if (section.items.length > 0) {
            await tx.item.createMany({
              data: section.items.map((i) => ({
                // The DB mints the id — rows are recreated wholesale, so trusting
                // a client-supplied PK only risks a cross-section P2002 collision.
                reportSectionId: sectionId,
                // Preserve the durable lineage key through the recreate. Undefined
                // for a brand-new record → omitted so the `@default(uuid())` mints
                // one; never `?? null` (the column is NOT NULL).
                stableId: i.stableId,
                // XOR parent: product-parented rows write projectId; activity-
                // parented rows write activityId (product FK null). The hand-written
                // CHECK is the backstop; the write schema already enforced XOR.
                projectId: i.projectId ?? null,
                activityId: i.activityId ?? null,
                type: i.type,
                text: i.text,
                tag: i.tag,
                workflowStatus: i.workflowStatus,
                carriedOver: i.carriedOver,
                priorityRank: i.priorityRank ?? null,
                pausedReason: i.pausedReason ?? null,
                stageNames: i.stageIds ?? [],
              })),
            });
          }

          if (section.risks.length > 0) {
            await tx.risk.createMany({
              data: section.risks.map((r) => ({
                reportSectionId: sectionId,
                // Preserve the durable lineage key (see items above).
                stableId: r.stableId,
                // XOR parent (see items above).
                projectId: r.projectId ?? null,
                activityId: r.activityId ?? null,
                risk: r.risk,
                impact: r.impact,
                mitigation: r.mitigation,
                severity: r.severity,
                stageNames: r.stageIds ?? [],
              })),
            });
          }

          // activity-first-class (Decision 6): persist a decision parented by
          // EITHER a product OR an activity (the write schema's XOR guarantees
          // exactly one). The old productId-only filter silently dropped every
          // activity-parented decision.
          const decisionsToSave = section.decisions.filter(
            (d) => d.productId != null || d.activityId != null,
          );
          if (decisionsToSave.length > 0) {
            await tx.decision.createMany({
              data: decisionsToSave.map((d) => ({
                reportSectionId: sectionId,
                // Preserve the durable lineage key (see items above).
                stableId: d.stableId,
                text: d.text,
                owner: d.owner,
                deadline: d.deadline ?? null,
                impact: d.impact,
                resolvedAt: d.resolvedAt ?? null,
                stageNames: d.stageIds ?? [],
                // XOR parent (product FK null for the activity case).
                productId: d.productId ?? null,
                activityId: d.activityId ?? null,
              })),
            });
          }

          // Re-anchor the captured comments onto the recreated records (matched
          // by lineage). Atomic with the version bump above.
          await reinsertRecordComments(tx, sectionId, capturedComments);

          // Re-read INSIDE this still-open transaction (read-your-own-writes),
          // not after it commits. The compare-and-set above already holds
          // this transaction's row lock on THIS ReportSection; a concurrent
          // report delete's cascade needs that same row lock to proceed and
          // blocks until this transaction finishes — so there is no longer a
          // post-commit gap for a delete to land in.
          const saved = await tx.reportSection.findUnique({
            where: { id: sectionId },
            include: reportSectionFullInclude,
          });

          if (!saved) {
            // Defensive only: this transaction holds the row lock it just
            // used for the compare-and-set, so a real DB should never reach
            // this branch.
            throw new SectionVersionConflictError(
              "This section was changed by another save. Reload and try again.",
            );
          }

          return mapPrismaToReportSection(saved);
        },
        { timeout: 15_000 },
      );
    } catch (error) {
      if (error instanceof SectionVersionConflictError) {
        throw error;
      }
      // The DB mints child ids now, but a duplicate (reportSectionId, projectId)
      // ProjectStatus (or any other unique violation) in a malformed payload can
      // still trip P2002 — surface it as a clean 400, never an unhandled 500.
      if (isUniqueViolation(error)) {
        throw new ReportSectionDomainError(
          "DUPLICATE_CHILD_ROW",
          "Could not save the section: a duplicate row was rejected.",
        );
      }
      throw error;
    }
  }

  getMyHistoryRows(authorId: string): Promise<readonly MyHistorySectionRow[]> {
    return queryMyHistoryRows(this.prisma, authorId);
  }
}
