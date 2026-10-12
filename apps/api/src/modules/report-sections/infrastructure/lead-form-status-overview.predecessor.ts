import type { Prisma } from "@prisma/client";
import {
  mapPrismaToReportSection,
  PublishedSnapshotIntegrityError,
  reportSectionFullInclude,
  requirePublishedSnapshot,
} from "@weeklyreport/report-persistence";
import {
  type LeadStatusOverviewPredecessor,
  leadStatusOverviewPredecessorSchema,
  type PublishedReportSectionReadModel,
  type PublishedReportSnapshot,
  reportSectionReadModelSchema,
  type Role,
  type SharedPublishedReportSectionReadModel,
  sharedPublishedReportSectionReadModelSchema,
} from "@weeklyreport/shared";

import { filterSectionToSharedProducts } from "../domain/lead-form-cross-author-scope.js";
import {
  frozenSharedProjectIds,
  getSharedNonArchivedProductIds,
} from "./lead-form-cross-author.query.js";

export interface StatusOverviewPredecessorRow {
  readonly id: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly publishedSnapshot: Prisma.JsonValue | null;
  readonly publishedSectionScopes: readonly {
    readonly authorId: string;
    readonly reportSectionId: string;
    readonly groupId: string;
  }[];
}

export interface StatusOverviewViewer {
  readonly authorId: string;
  readonly viewerId: string;
  readonly role: Role;
}

interface PredecessorScope extends StatusOverviewViewer {
  readonly viewerGroupId: string | null;
}

const unavailable = (
  report: Pick<
    StatusOverviewPredecessorRow,
    "id" | "periodStart" | "periodEnd"
  >,
  reason: "section_unavailable" | "invalid_published_snapshot",
): LeadStatusOverviewPredecessor => ({
  availability: "unavailable",
  reason,
  reportId: report.id,
  periodStart: report.periodStart,
  periodEnd: report.periodEnd,
});

function isPublishedScopeAdmitted(
  report: StatusOverviewPredecessorRow,
  { authorId, viewerId, role, viewerGroupId }: PredecessorScope,
): boolean {
  if (role === "admin") return true;
  if (role === "head") {
    return (
      viewerGroupId !== null &&
      report.publishedSectionScopes.some(
        (scope) =>
          scope.authorId === authorId && scope.groupId === viewerGroupId,
      )
    );
  }
  if (role !== "lead") return false;

  const admittedAuthors = new Set(
    report.publishedSectionScopes.map((scope) => scope.authorId),
  );
  return authorId === viewerId
    ? admittedAuthors.has(authorId)
    : admittedAuthors.has(authorId) && admittedAuthors.has(viewerId);
}

type PublishedSectionResolution =
  | {
      readonly section:
        PublishedReportSectionReadModel | SharedPublishedReportSectionReadModel;
    }
  | {
      readonly reason: "section_unavailable" | "invalid_published_snapshot";
    };

function scopePublishedSectionForViewer(
  snapshot: PublishedReportSnapshot,
  target: PublishedReportSectionReadModel,
  { authorId, viewerId, role }: StatusOverviewViewer,
): PublishedSectionResolution {
  if (role !== "lead" || authorId === viewerId) return { section: target };

  const viewer = snapshot.sections.find(
    (candidate) => candidate.authorId === viewerId,
  );
  if (!viewer) return { reason: "invalid_published_snapshot" };

  const sharedProjectIds = frozenSharedProjectIds(viewer, target);
  return sharedProjectIds.size === 0
    ? { reason: "section_unavailable" }
    : {
        section: sharedPublishedReportSectionReadModelSchema.parse(
          filterSectionToSharedProducts(target, sharedProjectIds),
        ),
      };
}

function publishedPredecessor(
  report: StatusOverviewPredecessorRow,
  scope: PredecessorScope,
): LeadStatusOverviewPredecessor {
  const { authorId } = scope;
  if (!isPublishedScopeAdmitted(report, scope)) {
    return unavailable(report, "section_unavailable");
  }

  try {
    const snapshot = requirePublishedSnapshot(
      report.publishedSnapshot,
      report.id,
    );
    const target = snapshot.sections.find(
      (section) => section.authorId === authorId,
    );
    if (!target) return unavailable(report, "invalid_published_snapshot");

    const resolution = scopePublishedSectionForViewer(snapshot, target, scope);
    if ("reason" in resolution) return unavailable(report, resolution.reason);

    return {
      availability: "available",
      source: "published",
      reportId: report.id,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      section: resolution.section,
    };
  } catch (error) {
    if (error instanceof PublishedSnapshotIntegrityError) {
      return unavailable(report, "invalid_published_snapshot");
    }
    throw error;
  }
}

function liveAuthorScope(
  role: Role,
  viewerGroupId: string | null,
): Prisma.ReportSectionWhereInput | null {
  if (role === "viewer") return null;
  if (role !== "head") return {};
  return viewerGroupId === null
    ? null
    : { author: { reportingGroupId: viewerGroupId } };
}

type LiveSharedScope =
  | { readonly admitted: false }
  | {
      readonly admitted: true;
      readonly projectIds: ReadonlySet<string> | null;
    };

async function resolveLiveSharedScope(
  tx: Prisma.TransactionClient,
  reportId: string,
  { authorId, viewerId, role }: StatusOverviewViewer,
): Promise<LiveSharedScope> {
  if (role !== "lead" || authorId === viewerId) {
    return { admitted: true, projectIds: null };
  }
  const own = await tx.reportSection.findUnique({
    where: { reportId_authorId: { reportId, authorId: viewerId } },
    select: { id: true },
  });
  if (!own) return { admitted: false };

  const ids = await getSharedNonArchivedProductIds(tx, viewerId, authorId);
  return ids.length === 0
    ? { admitted: false }
    : { admitted: true, projectIds: new Set(ids) };
}

async function submittedPredecessor(
  tx: Prisma.TransactionClient,
  report: StatusOverviewPredecessorRow,
  scope: PredecessorScope,
): Promise<LeadStatusOverviewPredecessor> {
  const { authorId } = scope;
  const authorScope = liveAuthorScope(scope.role, scope.viewerGroupId);
  if (authorScope === null) return unavailable(report, "section_unavailable");
  const sharedScope = await resolveLiveSharedScope(tx, report.id, scope);
  if (!sharedScope.admitted) return unavailable(report, "section_unavailable");

  const row = await tx.reportSection.findFirst({
    where: {
      reportId: report.id,
      authorId,
      status: "submitted",
      ...authorScope,
    },
    include: reportSectionFullInclude,
  });
  if (!row) return unavailable(report, "section_unavailable");

  const mapped = mapPrismaToReportSection(row);
  const section =
    sharedScope.projectIds === null
      ? reportSectionReadModelSchema.parse(mapped)
      : filterSectionToSharedProducts(mapped, sharedScope.projectIds);

  return leadStatusOverviewPredecessorSchema.parse({
    availability: "available",
    source: "submitted",
    reportId: report.id,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    section,
  });
}

/** Resolves one predecessor without exposing unscoped section content. */
export async function resolveStatusOverviewPredecessor(
  tx: Prisma.TransactionClient,
  report: StatusOverviewPredecessorRow,
  viewer: StatusOverviewViewer,
): Promise<LeadStatusOverviewPredecessor> {
  const { viewerId, role } = viewer;
  const viewerGroupId =
    role === "head"
      ? ((
          await tx.user.findUnique({
            where: { id: viewerId },
            select: { reportingGroupId: true },
          })
        )?.reportingGroupId ?? null)
      : null;

  const scope = { ...viewer, viewerGroupId };
  return report.publishedSnapshot !== null
    ? publishedPredecessor(report, scope)
    : submittedPredecessor(tx, report, scope);
}
