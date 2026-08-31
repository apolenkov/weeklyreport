import { requirePublishedSnapshot } from "@customreport/report-persistence";
import type { Role } from "@customreport/shared";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type { CrossAuthorSectionRow } from "../application/lead-form.service";
import {
  getCrossAuthorContent,
  getCrossAuthors,
  getPublishedCrossAuthorContent,
  getPublishedCrossAuthors,
  getPublishedSharedNonArchivedProductIds,
  getSharedNonArchivedProductIds,
} from "./lead-form-cross-author.query.js";

export function getSharedNonArchivedProductIdsForReportRead(
  prisma: PrismaService,
  reportId: string,
  viewerId: string,
  authorId: string,
): Promise<string[]> {
  return prisma.$transaction(
    async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId },
        select: { periodStatus: true, publishedSnapshot: true },
      });
      return report?.periodStatus === "published"
        ? getPublishedSharedNonArchivedProductIds(
            requirePublishedSnapshot(report.publishedSnapshot, reportId),
            viewerId,
            authorId,
          )
        : getSharedNonArchivedProductIds(tx, viewerId, authorId);
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export function getCrossAuthorsRead(
  prisma: PrismaService,
  reportId: string,
  userId: string,
  role?: Role,
): ReturnType<typeof getCrossAuthors> {
  return prisma.$transaction(
    async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId },
        select: { periodStatus: true, publishedSnapshot: true },
      });
      if (report?.periodStatus === "published") {
        return getPublishedCrossAuthors(
          requirePublishedSnapshot(report.publishedSnapshot, reportId),
          userId,
        );
      }
      if (role === "lead") {
        const own = await tx.reportSection.findUnique({
          where: { reportId_authorId: { reportId, authorId: userId } },
          select: { id: true },
        });
        if (!own) return [];
      }
      return getCrossAuthors(tx, reportId, userId);
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export function getCrossAuthorContentRead(
  prisma: PrismaService,
  reportId: string,
  userId: string,
): Promise<{ coOwnsShared: boolean; rows: CrossAuthorSectionRow[] }> {
  return prisma.$transaction(
    async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId },
        select: { periodStatus: true, publishedSnapshot: true },
      });
      if (report?.periodStatus === "published") {
        return getPublishedCrossAuthorContent(
          requirePublishedSnapshot(report.publishedSnapshot, reportId),
          userId,
        );
      }
      const own = await tx.reportSection.findUnique({
        where: { reportId_authorId: { reportId, authorId: userId } },
        select: { id: true },
      });
      return own
        ? getCrossAuthorContent(tx, reportId, userId)
        : { coOwnsShared: false, rows: [] };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
