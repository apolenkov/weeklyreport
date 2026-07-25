import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type {
  CrossAuthorSectionRow,
  CrossAuthorStatusRow,
} from "../domain/lead-form-shared";
import {
  buildCrossAuthorStatusRows,
  indexForeignSections,
} from "./lead-form-cross-author.derive.js";
import {
  fetchForeignContentAssignments,
  fetchForeignContentSections,
  fetchForeignStatusAssignments,
  fetchForeignStatusSections,
  fetchViewerProjectIds,
} from "./lead-form-cross-author.fetch.js";
import {
  buildCrossAuthorContentRows,
  groupCrossAuthorAuthors,
} from "./lead-form-cross-author-content.derive.js";

/**
 * The product ids the viewer and author BOTH hold a stage assignment on,
 * restricted to non-archived products. Mirrors step 1 of
 * {@link getCrossAuthorContent}: the viewer's assigned products intersected
 * with the author's assignments on those products, filtered by
 * `project.archived=false`. Report-independent (assignments are report-wide);
 * report access is proven separately by the caller's own-section read.
 * @param prisma - The prisma argument.
 * @param viewerId - The viewerId argument.
 * @param authorId - The authorId argument.
 */
export async function getSharedNonArchivedProductIds(
  prisma: PrismaService,
  viewerId: string,
  authorId: string,
): Promise<string[]> {
  const viewerProjectIds = await fetchViewerProjectIds(prisma, viewerId);
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

/**
 * Get Cross Authors.
 * @param prisma - The prisma argument.
 * @param reportId - The reportId argument.
 * @param userId - The userId argument.
 */
export async function getCrossAuthors(
  prisma: PrismaService,
  reportId: string,
  userId: string,
): Promise<CrossAuthorStatusRow[]> {
  const myProjectIds = await fetchViewerProjectIds(prisma, userId);
  if (myProjectIds.length === 0) return [];

  const others = await fetchForeignStatusAssignments(
    prisma,
    myProjectIds,
    userId,
  );
  const otherUserIds = [...new Set(others.map((o) => o.user.id))];
  const sections = await fetchForeignStatusSections(
    prisma,
    reportId,
    otherUserIds,
  );

  const { statusMap, risksByAuthor } = indexForeignSections(sections);
  return buildCrossAuthorStatusRows(others, statusMap, risksByAuthor);
}

/**
 * Get Cross Author Content.
 * @param prisma - The prisma argument.
 * @param reportId - The reportId argument.
 * @param userId - The userId argument.
 */
export async function getCrossAuthorContent(
  prisma: PrismaService,
  reportId: string,
  userId: string,
): Promise<{ coOwnsShared: boolean; rows: CrossAuthorSectionRow[] }> {
  const myProjectIds = await fetchViewerProjectIds(prisma, userId);
  if (myProjectIds.length === 0) return { coOwnsShared: false, rows: [] };

  const others = await fetchForeignContentAssignments(
    prisma,
    myProjectIds,
    userId,
  );

  // `coOwnsShared` is the authorization signal, kept separate from
  // row-emptiness so the service can distinguish a denied read (co-owns
  // nothing) from a legitimately empty one (co-owns a product, no records).
  const { authorEntries, coOwnsShared, otherUserIds } =
    groupCrossAuthorAuthors(others);
  if (!coOwnsShared) return { coOwnsShared: false, rows: [] };

  const sections = await fetchForeignContentSections(
    prisma,
    reportId,
    otherUserIds,
  );

  return {
    coOwnsShared,
    rows: buildCrossAuthorContentRows(sections, authorEntries),
  };
}
