import {
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "@customreport/report-persistence";
import type {
  PublishedLineage,
  ReportSectionReadModel,
} from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type {
  CrossAuthorSectionRow,
  LeadFormRepository,
} from "../application/lead-form.service";
import { type ReopenEligibilityFacts } from "../domain/lead-form-shared";
import { fillFromSectionTx } from "./fill-from.transaction.js";
import { getSharedNonArchivedProductIds } from "./lead-form-cross-author.query.js";
import {
  getCrossAuthorContentRead,
  getCrossAuthorsRead,
  getSharedNonArchivedProductIdsForReportRead,
} from "./lead-form-cross-author.reads.js";
import {
  createReopenRequestTx,
  revokeAllSubmittedTx,
  revokeSectionSubmissionTx,
} from "./lead-form-lifecycle-writes.js";
import {
  getSectionForPeriodAsGroupPeerRead,
  getSectionForPeriodRead,
} from "./lead-form-period.reads.js";
import { getSectionReopenContext } from "./lead-form-reopen-eligibility.query.js";
import {
  publishedLineageCandidates,
  queryPublishedLineage,
} from "./published-lineage.query.js";

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
  getPublishedLineage(
    section: ReportSectionReadModel,
  ): Promise<PublishedLineage> {
    return queryPublishedLineage(
      this.prisma,
      publishedLineageCandidates(section),
    );
  }

  async getUserReportingGroupId(userId: string): Promise<string | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reportingGroupId: true },
    });
    return row?.reportingGroupId ?? null;
  }

  async getSectionForPeriod(
    reportId: string,
    userId: string,
  ): ReturnType<LeadFormRepository["getSectionForPeriod"]> {
    return getSectionForPeriodRead(this.prisma, reportId, userId);
  }

  async getSectionForPeriodAsGroupPeer(
    reportId: string,
    authorId: string,
    peerUserId: string,
  ): ReturnType<LeadFormRepository["getSectionForPeriodAsGroupPeer"]> {
    return getSectionForPeriodAsGroupPeerRead(
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
    await revokeSectionSubmissionTx(this.prisma, sectionId, revokedBy);
  }

  // Revoke every submitted section in a report.
  async revokeAllSubmitted(
    reportId: string,
    revokedBy: string,
    scope: Record<string, unknown>,
  ): Promise<number> {
    return revokeAllSubmittedTx(this.prisma, reportId, revokedBy, scope);
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
    await createReopenRequestTx(this.prisma, sectionId, userId, reason);
  }

  getSharedNonArchivedProductIds(
    viewerId: string,
    authorId: string,
  ): Promise<string[]> {
    return getSharedNonArchivedProductIds(this.prisma, viewerId, authorId);
  }

  async getSharedNonArchivedProductIdsForReport(
    reportId: string,
    viewerId: string,
    authorId: string,
  ): Promise<string[]> {
    return getSharedNonArchivedProductIdsForReportRead(
      this.prisma,
      reportId,
      viewerId,
      authorId,
    );
  }

  getCrossAuthors(
    reportId: string,
    userId: string,
    role?: import("@customreport/shared").Role,
  ): ReturnType<LeadFormRepository["getCrossAuthors"]> {
    return getCrossAuthorsRead(this.prisma, reportId, userId, role);
  }

  getCrossAuthorContent(
    reportId: string,
    userId: string,
  ): Promise<{ coOwnsShared: boolean; rows: CrossAuthorSectionRow[] }> {
    return getCrossAuthorContentRead(this.prisma, reportId, userId);
  }
}
