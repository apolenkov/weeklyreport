import type { ReportSectionReadModel } from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { isUniqueViolation } from "../../../lib/prisma-unique-violation.js";
import type {
  CrossAuthorSectionRow,
  LeadFormRepository,
} from "../application/lead-form.service";
import { applyRevokeTransition } from "../application/revoke-transition";
import type { ReopenEligibilityFacts } from "../domain/lead-form-shared";
import {
  reopenBlockedMessage,
  ReopenRequestError,
} from "../domain/lead-form-shared";
import { fillFromSectionTx } from "./fill-from.transaction.js";
import {
  getCrossAuthorContent,
  getCrossAuthors,
  getSharedNonArchivedProductIds,
} from "./lead-form-cross-author.query.js";
import {
  getSectionForPeriod,
  getSectionForPeriodAsGroupPeer,
  getSectionReopenContext,
  type SectionForPeriodResult,
} from "./lead-form-reopen-eligibility.query.js";
import { queryPublishedLineage } from "./published-lineage.query.js";
import { reportSectionFullInclude } from "./report-sections.include";
import { mapPrismaToReportSection } from "./report-sections.mappers";

@Injectable()
export class LeadFormPrismaRepository implements LeadFormRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // The section read model carries no per-section brand label; frontends pull
  // it from `auth.me.organization` (hydrated per request) so the source of
  // truth is one row in `Organization`.

  async getSectionById(
    sectionId: string,
  ): Promise<ReportSectionReadModel | null> {
    const row = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      include: reportSectionFullInclude,
    });

    if (!row) {
      return null;
    }

    return mapPrismaToReportSection(row);
  }

  async getSectionByIdScoped(
    sectionId: string,
    scope: Record<string, unknown>,
  ): Promise<ReportSectionReadModel | null> {
    // The `reportSection` scope is a relation filter on `author.reportingGroupId`
    // (`{}` for admin). Spread last so a zero-row scope can override the id —
    // an out-of-group id then resolves to null (rejected as not-found upstream).
    const row = await this.prisma.reportSection.findFirst({
      where: { id: sectionId, ...scope },
      include: reportSectionFullInclude,
    });

    if (!row) {
      return null;
    }

    return mapPrismaToReportSection(row);
  }

  async getReportPeriodStatusForSection(
    sectionId: string,
  ): Promise<string | null> {
    const row = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      select: { report: { select: { periodStatus: true } } },
    });
    return row?.report.periodStatus ?? null;
  }

  // Published lineage for the byPeriod read — the same resolve-not-delete
  // reference set the save guard uses, surfaced so the form can mark locked
  // records. One shared query definition, no second copy.
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

  async getUserReportingGroupId(userId: string): Promise<string | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reportingGroupId: true },
    });
    return row?.reportingGroupId ?? null;
  }

  getSectionForPeriod(
    reportId: string,
    userId: string,
  ): Promise<SectionForPeriodResult | null> {
    return getSectionForPeriod(this.prisma, reportId, userId);
  }

  getSectionForPeriodAsGroupPeer(
    reportId: string,
    authorId: string,
    peerUserId: string,
  ): Promise<SectionForPeriodResult | null> {
    return getSectionForPeriodAsGroupPeer(
      this.prisma,
      reportId,
      authorId,
      peerUserId,
    );
  }

  getSectionReopenContext(
    sectionId: string,
  ): Promise<{ authorId: string; facts: ReopenEligibilityFacts } | null> {
    return getSectionReopenContext(this.prisma, sectionId);
  }

  async revokeSectionSubmission(
    sectionId: string,
    revokedBy: string,
  ): Promise<void> {
    // The caller's scoped read proved the id is in the caller's group, so the
    // write is by id only; the shared transition's `status: "submitted"` guard
    // keeps it race-safe. The changes_requested verdict reuses this transition.
    await applyRevokeTransition(this.prisma, sectionId, revokedBy);
  }

  // Revoke every submitted section in a report.
  async revokeAllSubmitted(
    reportId: string,
    revokedBy: string,
    scope: Record<string, unknown>,
  ): Promise<number> {
    // One scoped, race-safe write: the group-scope filter spreads into the
    // `where` (head flips only their own group; admin = `{}` → all). The
    // periodStatus filter is the same published-period gate the revoke enforces.
    const result = await this.prisma.reportSection.updateMany({
      where: {
        reportId,
        status: "submitted",
        report: { periodStatus: { in: ["open", "reopened"] } },
        ...scope,
      },
      data: {
        status: "draft",
        revokedAt: new Date(),
        revokedBy,
        submittedAt: null,
      },
    });
    return result.count;
  }

  fillFromSection(
    targetSectionId: string,
    sourceSectionId: string,
    expectedVersion: number,
  ): Promise<number> {
    return fillFromSectionTx(
      this.prisma,
      targetSectionId,
      sourceSectionId,
      expectedVersion,
    );
  }

  async createReopenRequest(
    sectionId: string,
    userId: string,
    reason?: string,
  ): Promise<void> {
    // Persist the request as a ReopenRequest row for the Admin Panel. Status
    // starts `pending`; the head's approve/reject updates the row and may flip
    // the section back to draft when approved.
    try {
      await this.prisma.reopenRequest.create({
        data: {
          reportSectionId: sectionId,
          requestedById: userId,
          reason: reason && reason.trim().length > 0 ? reason.trim() : null,
        },
      });
    } catch (error) {
      // A true race passes the app-level check on both calls, then the
      // one-pending partial unique index rejects the second with P2002 —
      // translated to the same friendly domain error, never a 500.
      if (isUniqueViolation(error)) {
        throw new ReopenRequestError(
          reopenBlockedMessage("pending_request_exists"),
        );
      }
      throw error;
    }
  }

  getSharedNonArchivedProductIds(
    viewerId: string,
    authorId: string,
  ): Promise<string[]> {
    return getSharedNonArchivedProductIds(this.prisma, viewerId, authorId);
  }

  getCrossAuthors(
    reportId: string,
    userId: string,
  ): ReturnType<typeof getCrossAuthors> {
    return getCrossAuthors(this.prisma, reportId, userId);
  }

  getCrossAuthorContent(
    reportId: string,
    userId: string,
  ): Promise<{ coOwnsShared: boolean; rows: CrossAuthorSectionRow[] }> {
    return getCrossAuthorContent(this.prisma, reportId, userId);
  }
}
