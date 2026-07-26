import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";

/**
 * The caller's distinct assigned productIds (report-wide; assignments are not
 * report-scoped). Both cross-author reads start from this same join.
 */
export async function fetchViewerProjectIds(
  prisma: PrismaService,
  userId: string,
): Promise<string[]> {
  const assignments = await prisma.stageAssignment.findMany({
    where: { userId },
    select: { projectId: true },
  });
  return [...new Set(assignments.map((r) => r.projectId))];
}

/** Other users' stage assignments on the caller's products (status-only read). */
export function fetchForeignStatusAssignments(
  prisma: PrismaService,
  myProjectIds: string[],
  userId: string,
) {
  return prisma.stageAssignment.findMany({
    where: { projectId: { in: myProjectIds }, userId: { not: userId } },
    select: {
      projectId: true,
      stageId: true,
      project: { select: { id: true, name: true, archived: true } },
      stage: { select: { name: true } },
      user: { select: { id: true, name: true } },
    },
  });
}

/**
 * Persisted stage traffic + covering risks for each foreign author in this
 * report. Only `severity` + `stageNames` of the risk are needed: the stage
 * status is RISK-DERIVED (covering risks that name the stage), never the
 * foreign item text. The persisted traffic is consulted only as the
 * empty/non-empty base when no risk covers the stage.
 */
export function fetchForeignStatusSections(
  prisma: PrismaService,
  reportId: string,
  otherUserIds: string[],
) {
  return prisma.reportSection.findMany({
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
}

/**
 * Co-owners on shared, NON-ARCHIVED products, with the author's role (the
 * full-content read scopes to non-archived products only).
 */
export function fetchForeignContentAssignments(
  prisma: PrismaService,
  myProjectIds: string[],
  userId: string,
) {
  return prisma.stageAssignment.findMany({
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
}

/** Foreign sections with full item/risk/decision text + covering risks. */
// The select shape is data, not logic — hoisted so the fetch function itself
// stays inside the 50-line function budget.
const foreignContentSectionSelect = {
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
} as const;

export function fetchForeignContentSections(
  prisma: PrismaService,
  reportId: string,
  otherUserIds: string[],
) {
  return prisma.reportSection.findMany({
    where: { reportId, authorId: { in: otherUserIds } },
    select: foreignContentSectionSelect,
  });
}
