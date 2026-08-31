import { requirePublishedSnapshot } from "@customreport/report-persistence";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import {
  getSectionForPeriod,
  getSectionForPeriodAsGroupPeer,
  type SectionForPeriodResult,
} from "./lead-form-reopen-eligibility.query.js";
import { requireScopedPublishedSnapshot } from "./published-report-scope.js";

export async function getSectionForPeriodRead(
  prisma: PrismaService,
  reportId: string,
  userId: string,
): Promise<SectionForPeriodResult | null> {
  return prisma.$transaction(
    (tx) => getSectionForPeriodInSnapshot(tx, reportId, userId),
    { isolationLevel: "RepeatableRead" },
  );
}

async function getSectionForPeriodInSnapshot(
  tx: Prisma.TransactionClient,
  reportId: string,
  userId: string,
): Promise<SectionForPeriodResult | null> {
  const report = await tx.report.findUnique({
    where: { id: reportId },
    select: { periodStatus: true, archived: true, publishedSnapshot: true },
  });
  if (report?.periodStatus === "published") {
    const admitted = await tx.publishedSectionScope.findFirst({
      where: { reportId, authorId: userId },
      select: { reportSectionId: true },
    });
    if (!admitted) return null;
    const section = requirePublishedSnapshot(
      report.publishedSnapshot,
      reportId,
    ).sections.find(
      (candidate) =>
        candidate.reportSectionId === admitted.reportSectionId &&
        candidate.authorId === userId,
    );
    return section
      ? {
          section,
          readOnly: true,
          reopenFacts: {
            sectionStatus: section.status,
            periodStatus: "published",
            archived: report.archived,
            hasPendingReopen: false,
          },
        }
      : null;
  }
  return getSectionForPeriod(tx, reportId, userId);
}

export async function getSectionForPeriodAsGroupPeerRead(
  prisma: PrismaService,
  reportId: string,
  authorId: string,
  peerUserId: string,
): Promise<SectionForPeriodResult | null> {
  return prisma.$transaction(
    async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId },
        select: { periodStatus: true, archived: true, publishedSnapshot: true },
      });
      if (report?.periodStatus === "published") {
        const peer = await tx.user.findUnique({
          where: { id: peerUserId },
          select: { reportingGroupId: true },
        });
        const groupId = peer?.reportingGroupId;
        if (!groupId) return null;
        const admitted = await tx.publishedSectionScope.findFirst({
          where: { reportId, authorId, groupId },
          select: { reportSectionId: true },
        });
        const section = admitted
          ? requireScopedPublishedSnapshot(
              requirePublishedSnapshot(report.publishedSnapshot, reportId),
              {
                role: "head",
                reportingGroupId: groupId,
                viewerGroupAccess: [],
              },
              "group",
              admitted.reportSectionId,
            ).sections.find(
              (candidate) =>
                candidate.reportSectionId === admitted.reportSectionId,
            )
          : undefined;
        return section
          ? {
              section,
              readOnly: true,
              reopenFacts: {
                sectionStatus: section.status,
                periodStatus: "published",
                archived: report.archived,
                hasPendingReopen: false,
              },
            }
          : null;
      }
      return getSectionForPeriodAsGroupPeer(tx, reportId, authorId, peerUserId);
    },
    { isolationLevel: "RepeatableRead" },
  );
}
