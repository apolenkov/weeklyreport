import { requirePublishedSnapshot } from "@customreport/report-persistence";
import {
  initialsFromName,
  itemWorkflowStatusSchema,
  type PublishedReportSectionReadModel,
  riskSeveritySchema,
  shortNameFromName,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import type {
  CrossAuthorSectionRow,
  CrossAuthorStatusRow,
} from "../domain/lead-form-shared";
import {
  buildCrossAuthorStatusRows,
  deriveForeignStageStatus,
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

type PrismaReader = Prisma.TransactionClient;

function frozenOwnedProjects(section: PublishedReportSectionReadModel) {
  return new Map(
    section.projects
      .filter((project) => project.ownedStages.length > 0)
      .map((project) => [project.projectId, project] as const),
  );
}

export function frozenSharedProjectIds(
  viewer: PublishedReportSectionReadModel,
  foreign: PublishedReportSectionReadModel,
): ReadonlySet<string> {
  const viewerProjects = frozenOwnedProjects(viewer);
  return new Set(
    [...frozenOwnedProjects(foreign).keys()].filter((id) =>
      viewerProjects.has(id),
    ),
  );
}

function frozenStageStatus(
  section: PublishedReportSectionReadModel,
  project: PublishedReportSectionReadModel["projects"][number],
  stage: PublishedReportSectionReadModel["projects"][number]["ownedStages"][number],
) {
  return deriveForeignStageStatus(
    stage.stageName,
    project.projectId,
    section.risks.map((risk) => ({
      projectId: risk.projectId ?? null,
      severity: riskSeveritySchema.parse(risk.severity),
      stageNames: [...risk.stageNames],
    })),
    stage.status ?? null,
  );
}

export function getPublishedCrossAuthors(
  snapshot: ReturnType<typeof requirePublishedSnapshot>,
  userId: string,
): CrossAuthorStatusRow[] {
  const viewer = snapshot.sections.find(
    (section) => section.authorId === userId,
  );
  if (!viewer) return [];
  return snapshot.sections.flatMap((section) => {
    if (section.authorId === userId) return [];
    const sharedIds = frozenSharedProjectIds(viewer, section);
    return [...frozenOwnedProjects(section).values()]
      .filter((project) => sharedIds.has(project.projectId))
      .map((project) => ({
        projectId: project.projectId,
        projectName: project.projectName,
        authorId: section.authorId,
        authorInitials: initialsFromName(section.authorName),
        authorShortName: shortNameFromName(section.authorName),
        stageNames: project.ownedStages.map((stage) => stage.stageName),
        stages: project.ownedStages.map((stage) => ({
          stageName: stage.stageName,
          status: frozenStageStatus(section, project, stage),
        })),
      }));
  });
}

export function getPublishedCrossAuthorContent(
  snapshot: ReturnType<typeof requirePublishedSnapshot>,
  userId: string,
): { coOwnsShared: boolean; rows: CrossAuthorSectionRow[] } {
  const viewer = snapshot.sections.find(
    (section) => section.authorId === userId,
  );
  if (!viewer) return { coOwnsShared: false, rows: [] };
  const rows = snapshot.sections.flatMap((section) => {
    if (section.authorId === userId) return [];
    const sharedIds = frozenSharedProjectIds(viewer, section);
    if (sharedIds.size === 0) return [];
    return [
      {
        authorId: section.authorId,
        authorName: section.authorName,
        authorRole: section.authorRole,
        sharedProductIds: [...sharedIds],
        stages: [...frozenOwnedProjects(section).values()]
          .filter((project) => sharedIds.has(project.projectId))
          .flatMap((project) =>
            project.ownedStages.map((stage) => ({
              projectId: project.projectId,
              stageName: stage.stageName,
              status: frozenStageStatus(section, project, stage),
            })),
          ),
        items: section.items
          .filter(
            (item): item is typeof item & { projectId: string } =>
              item.projectId !== null &&
              item.projectId !== undefined &&
              sharedIds.has(item.projectId),
          )
          .map((item) => ({
            id: item.id,
            projectId: item.projectId,
            type: item.type,
            text: item.text,
            tag: item.tag,
            workflowStatus: itemWorkflowStatusSchema.parse(item.workflowStatus),
            carriedOver: item.carriedOver,
            priorityRank: item.priorityRank ?? null,
            stageNames: [...item.stageNames],
          })),
        risks: section.risks
          .filter(
            (risk): risk is typeof risk & { projectId: string } =>
              risk.projectId !== null &&
              risk.projectId !== undefined &&
              sharedIds.has(risk.projectId),
          )
          .map((risk) => ({
            id: risk.id,
            projectId: risk.projectId,
            risk: risk.risk,
            impact: risk.impact,
            mitigation: risk.mitigation,
            severity: riskSeveritySchema.parse(risk.severity),
            stageNames: [...risk.stageNames],
          })),
        decisions: section.decisions
          .filter(
            (decision): decision is typeof decision & { productId: string } =>
              decision.productId !== null &&
              decision.productId !== undefined &&
              sharedIds.has(decision.productId),
          )
          .map((decision) => ({
            id: decision.id,
            productId: decision.productId,
            text: decision.text,
            owner: decision.owner,
            deadline: decision.deadline ?? null,
            impact: decision.impact,
            resolvedAt: decision.resolvedAt ?? null,
            stageNames: [...decision.stageNames],
          })),
      },
    ];
  });
  return { coOwnsShared: rows.length > 0, rows };
}

export function getPublishedSharedNonArchivedProductIds(
  snapshot: ReturnType<typeof requirePublishedSnapshot>,
  viewerId: string,
  authorId: string,
): string[] {
  const viewer = snapshot.sections.find(
    (section) => section.authorId === viewerId,
  );
  const foreign = snapshot.sections.find(
    (section) => section.authorId === authorId,
  );
  return viewer && foreign ? [...frozenSharedProjectIds(viewer, foreign)] : [];
}

// Product ids the viewer and author BOTH hold a stage assignment on, restricted
// to non-archived products. Report-independent (assignments are report-wide);
// report access is proven separately by the caller's own-section read.
export async function getSharedNonArchivedProductIds(
  prisma: PrismaReader,
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

export async function getCrossAuthors(
  prisma: PrismaReader,
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

export async function getCrossAuthorContent(
  prisma: PrismaReader,
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
