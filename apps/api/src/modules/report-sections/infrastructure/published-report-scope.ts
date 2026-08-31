import { computePortfolioOverviewFromReadSections } from "@customreport/report-persistence";
import { PublishedSnapshotIntegrityError } from "@customreport/report-persistence";
import {
  type PublishedReportSnapshot,
  publishedReportSnapshotSchema,
  type UserSession,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import { computeAllowedGroupIds } from "../../../lib/group-scope.js";

export type PublishedSnapshotScopeMode = "group" | "lead-own";

type PublishedSnapshotScopeSession = Pick<
  UserSession,
  "role" | "reportingGroupId" | "viewerGroupAccess"
> &
  Partial<Pick<UserSession, "userId">>;

type ResolvedPublishedScope =
  | { readonly kind: "all" }
  | { readonly kind: "none" }
  | { readonly kind: "author"; readonly authorId: string }
  | { readonly kind: "groups"; readonly groupIds: readonly string[] };

function resolvePublishedScope(
  session: PublishedSnapshotScopeSession,
  mode: PublishedSnapshotScopeMode,
): ResolvedPublishedScope {
  if (session.role === "admin") return { kind: "all" };
  if (mode === "lead-own" && session.role === "lead") {
    return session.userId === undefined
      ? { kind: "none" }
      : { kind: "author", authorId: session.userId };
  }
  const groupIds = computeAllowedGroupIds(session);
  return groupIds.length === 0
    ? { kind: "none" }
    : { kind: "groups", groupIds };
}

export function filterSnapshotSections(
  snapshot: PublishedReportSnapshot,
  allowedSectionIds: ReadonlySet<string> | undefined,
): PublishedReportSnapshot {
  if (!allowedSectionIds) return snapshot;

  const sections = snapshot.sections.filter((section) =>
    allowedSectionIds.has(section.reportSectionId),
  );

  return publishedReportSnapshotSchema.parse({
    ...snapshot,
    portfolioOverview: computePortfolioOverviewFromReadSections(sections),
    sections,
  });
}

/**
 * Indexed DB admission filter derived from the same role policy as the pure
 * snapshot filter. Projection rows are frozen and written atomically with the
 * snapshot; no mutable ReportSection/User relation participates.
 */
export function publishedReportScopeWhere(
  session: PublishedSnapshotScopeSession,
  mode: PublishedSnapshotScopeMode = "group",
): Prisma.ReportWhereInput {
  const scope = resolvePublishedScope(session, mode);
  switch (scope.kind) {
    case "all":
      return {};
    case "none":
      return {
        publishedSectionScopes: { some: { reportId: { in: [] } } },
      };
    case "author":
      return {
        publishedSectionScopes: { some: { authorId: scope.authorId } },
      };
    case "groups":
      return {
        publishedSectionScopes: {
          some: { groupId: { in: [...scope.groupIds] } },
        },
      };
  }
}

/**
 * Scopes immutable publication content without consulting mutable section or
 * user rows. `lead-own` preserves the compiled-history contract; ordinary
 * weekly/archive/PDF reads retain their existing group visibility.
 */
export function filterPublishedSnapshotForSession(
  snapshot: PublishedReportSnapshot,
  session: PublishedSnapshotScopeSession,
  mode: PublishedSnapshotScopeMode = "group",
): PublishedReportSnapshot {
  const scope = resolvePublishedScope(session, mode);
  if (scope.kind === "all") return snapshot;
  if (scope.kind === "none") {
    return filterSnapshotSections(snapshot, new Set());
  }
  if (scope.kind === "author") {
    return filterSnapshotSections(
      snapshot,
      new Set(
        snapshot.sections
          .filter((section) => section.authorId === scope.authorId)
          .map((section) => section.reportSectionId),
      ),
    );
  }

  const allowedGroupIds = new Set(scope.groupIds);
  return filterSnapshotSections(
    snapshot,
    new Set(
      snapshot.sections
        .filter((section) => allowedGroupIds.has(section.groupId))
        .map((section) => section.reportSectionId),
    ),
  );
}

/**
 * Applies the same immutable scope used after DB admission and rejects an
 * admitted non-admin row whose snapshot has no matching sections. A missing
 * DB row remains the caller's ordinary unauthorized result.
 */
export function requireScopedPublishedSnapshot(
  snapshot: PublishedReportSnapshot,
  session: PublishedSnapshotScopeSession,
  mode: PublishedSnapshotScopeMode = "group",
  expectedSectionId?: string,
): PublishedReportSnapshot {
  const scoped = filterPublishedSnapshotForSession(snapshot, session, mode);
  if (
    session.role !== "admin" &&
    (scoped.sections.length === 0 ||
      (expectedSectionId !== undefined &&
        !scoped.sections.some(
          (section) => section.reportSectionId === expectedSectionId,
        )))
  ) {
    throw new PublishedSnapshotIntegrityError(
      `Published snapshot integrity failure for report ${snapshot.reportId}: indexed section scope does not match the snapshot.`,
    );
  }
  return scoped;
}

export function canReadPublishedSnapshot(
  snapshot: PublishedReportSnapshot,
  session: PublishedSnapshotScopeSession,
  mode: PublishedSnapshotScopeMode = "group",
): boolean {
  return (
    session.role === "admin" ||
    filterPublishedSnapshotForSession(snapshot, session, mode).sections.length >
      0
  );
}
