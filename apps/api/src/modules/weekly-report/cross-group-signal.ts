import { computeAllowedGroupIds } from "../../lib/group-scope.js";
import type {
  WeeklyReportRepositoryResult,
  WeeklyReportScopeSession,
} from "./weekly-report.service.js";

// Cross-group when owner group is outside caller's allowed ids yet the product
// still surfaced. Pass only projects in the delivered read model; one signal/request.
export function computeCrossGroupSignal(
  session: WeeklyReportScopeSession | undefined,
  projects: { id: string; lead: { reportingGroupId: string | null } | null }[],
): WeeklyReportRepositoryResult["crossGroup"] {
  if (!session || session.role === "admin") return null;

  const allowedGroupIds = computeAllowedGroupIds(session);
  if (allowedGroupIds.length === 0) return null;

  const allowedSet = new Set(allowedGroupIds);
  const entries = projects
    .map((project) => ({
      id: project.id,
      ownerGroupId: project.lead?.reportingGroupId ?? null,
    }))
    .filter(
      (entry): entry is { id: string; ownerGroupId: string } =>
        entry.ownerGroupId !== null && !allowedSet.has(entry.ownerGroupId),
    );

  if (entries.length === 0) return null;

  return {
    productIds: entries.map((entry) => entry.id),
    groupIds: [...new Set(entries.map((entry) => entry.ownerGroupId))],
  };
}

// Use snapshot-frozen ownerGroupId — never live re-query (post-publish archive
// would drop the product and silently escape the signal). Missing owner = not cross-group.
export function computeCrossGroupSignalFromSnapshotProjects(
  session: WeeklyReportScopeSession | undefined,
  projects: { projectId: string; ownerGroupId?: string | null }[],
): WeeklyReportRepositoryResult["crossGroup"] {
  if (!session || session.role === "admin") return null;

  const allowedGroupIds = computeAllowedGroupIds(session);
  if (allowedGroupIds.length === 0) return null;

  const allowedSet = new Set(allowedGroupIds);
  const crossGroupOwnerByProductId = new Map<string, string>();

  for (const { projectId, ownerGroupId } of projects) {
    if (ownerGroupId != null && !allowedSet.has(ownerGroupId)) {
      crossGroupOwnerByProductId.set(projectId, ownerGroupId);
    }
  }

  if (crossGroupOwnerByProductId.size === 0) return null;

  return {
    productIds: [...crossGroupOwnerByProductId.keys()],
    groupIds: [...new Set(crossGroupOwnerByProductId.values())],
  };
}
