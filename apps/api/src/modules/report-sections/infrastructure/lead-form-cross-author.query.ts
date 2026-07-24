import type { TrafficLightStatus } from "@customreport/shared";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type { CrossAuthorSectionRow } from "../application/lead-form.service";
import {
  buildCrossAuthorStatusRows,
  indexForeignSections,
} from "./lead-form-cross-author.derive.js";
import {
  buildCrossAuthorContentRows,
  groupCrossAuthorAuthors,
} from "./lead-form-cross-author-content.derive.js";

/** API traffic-light enum; null = no data / untouched stage. */
type StageTrafficStatus = TrafficLightStatus | null;

/**
 * The product ids the viewer and author BOTH hold a stage assignment on,
 * restricted to non-archived products. Mirrors step 1 of
 * {@link getCrossAuthorContent}: the viewer's assigned products intersected
 * with the author's assignments on those products, filtered by
 * `project.archived=false`. Report-independent (assignments are report-wide);
 * report access is proven separately by the caller's own-section read.
 */
export async function getSharedNonArchivedProductIds(
  prisma: PrismaService,
  viewerId: string,
  authorId: string,
): Promise<string[]> {
  const viewerAssignments = await prisma.stageAssignment.findMany({
    where: { userId: viewerId },
    select: { projectId: true },
  });
  const viewerProjectIds = [
    ...new Set(viewerAssignments.map((r) => r.projectId)),
  ];
  if (viewerProjectIds.length === 0) {
    return [];
  }

  const shared = await prisma.stageAssignment.findMany({
    where: {
      projectId: { in: viewerProjectIds },
      userId: authorId,
      project: { archived: false },
    },
    select: { projectId: true },
  });
  return [...new Set(shared.map((r) => r.projectId))];
}

export async function getCrossAuthors(
  prisma: PrismaService,
  reportId: string,
  userId: string,
): Promise<
  {
    projectId: string;
    projectName: string;
    authorId: string;
    authorInitials: string;
    authorShortName: string;
    stageNames: string[];
    stages: {
      stageName: string;
      status: StageTrafficStatus;
    }[];
  }[]
> {
  const myAssignments = await prisma.stageAssignment.findMany({
    where: { userId },
    select: { projectId: true },
  });
  const myProjectIds = [...new Set(myAssignments.map((r) => r.projectId))];
  if (myProjectIds.length === 0) return [];

  // Other users' stage assignments on shared projects
  const others = await prisma.stageAssignment.findMany({
    where: { projectId: { in: myProjectIds }, userId: { not: userId } },
    select: {
      projectId: true,
      stageId: true,
      project: { select: { id: true, name: true, archived: true } },
      stage: { select: { name: true } },
      user: { select: { id: true, name: true } },
    },
  });

  // Persisted stage traffic + covering risks for each foreign author in this
  // report. Only `severity` + `stageNames` of the risk are needed: the stage
  // status is RISK-DERIVED (covering risks that name the stage), never the
  // foreign item text. The persisted traffic is consulted only as the
  // empty/non-empty base when no risk covers the stage.
  const otherUserIds = [...new Set(others.map((o) => o.user.id))];
  const sections = await prisma.reportSection.findMany({
    where: { reportId, authorId: { in: otherUserIds } },
    select: {
      authorId: true,
      risks: {
        select: { projectId: true, severity: true, stageNames: true },
      },
      stageStatuses: {
        select: { projectId: true, stageId: true, status: true },
      },
    },
  });

  const { statusMap, risksByAuthor } = indexForeignSections(sections);
  return buildCrossAuthorStatusRows(others, statusMap, risksByAuthor);
}

export async function getCrossAuthorContent(
  prisma: PrismaService,
  reportId: string,
  userId: string,
): Promise<{ coOwnsShared: boolean; rows: CrossAuthorSectionRow[] }> {
  // Step 1: resolve the caller's assigned products (same join as
  // getCrossAuthors), then co-owners on shared, NON-ARCHIVED products.
  const myAssignments = await prisma.stageAssignment.findMany({
    where: { userId },
    select: { projectId: true },
  });
  const myProjectIds = [...new Set(myAssignments.map((r) => r.projectId))];
  if (myProjectIds.length === 0) return { coOwnsShared: false, rows: [] };

  const others = await prisma.stageAssignment.findMany({
    where: {
      projectId: { in: myProjectIds },
      userId: { not: userId },
      project: { archived: false },
    },
    select: {
      projectId: true,
      stageId: true,
      stage: { select: { name: true } },
      user: { select: { id: true, name: true, role: true } },
    },
  });

  // Per-author set of shared, non-archived projectIds + the author's stage
  // assignments on those products (the chips come from assignments, not the
  // section — a co-owner's stage exists even with no persisted status row).
  // `coOwnsShared` is the co-ownership authorization signal: true iff the
  // caller co-owns at least one shared, non-archived product. It is kept
  // separate from row-emptiness so the service can label a denied read
  // (co-owns nothing) distinctly from a legitimately empty one (co-owns a
  // product but the co-owner authored no records).
  const { authorEntries, coOwnsShared, otherUserIds } =
    groupCrossAuthorAuthors(others);
  if (!coOwnsShared) return { coOwnsShared: false, rows: [] };

  // Step 2: fetch foreign sections + covering risks (for risk-derived chips).
  const sections = await prisma.reportSection.findMany({
    where: { reportId, authorId: { in: otherUserIds } },
    select: {
      authorId: true,
      items: {
        select: {
          id: true,
          projectId: true,
          type: true,
          text: true,
          tag: true,
          workflowStatus: true,
          carriedOver: true,
          priorityRank: true,
          stageNames: true,
        },
      },
      risks: {
        select: {
          id: true,
          projectId: true,
          risk: true,
          impact: true,
          mitigation: true,
          severity: true,
          stageNames: true,
        },
      },
      decisions: {
        select: {
          id: true,
          productId: true,
          text: true,
          owner: true,
          deadline: true,
          impact: true,
          resolvedAt: true,
          stageNames: true,
        },
      },
      stageStatuses: {
        select: { projectId: true, stageId: true, status: true },
      },
    },
  });

  // Step 3: build per-author rows filtered to shared products only.
  return {
    coOwnsShared,
    rows: buildCrossAuthorContentRows(sections, authorEntries),
  };
}
