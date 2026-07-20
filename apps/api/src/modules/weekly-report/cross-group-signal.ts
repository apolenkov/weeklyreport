import { computeAllowedGroupIds } from "../../lib/group-scope.js";
import type {
  WeeklyReportRepositoryResult,
  WeeklyReportScopeSession,
} from "./weekly-report.service.js";

/**
 * Compute the cross-group audit signal from the surfaced projects.
 *
 * A product is cross-group when its lead's `reportingGroupId` (natural
 * owner) is NOT in the caller's allowed group ids, yet it surfaced via
 * the explicit GroupProduct join. Admin sessions and unscoped paths
 * produce no signal (admin has no scope filter; unauthenticated paths
 * are not audited).
 *
 * Callers must pass only the projects that actually surface in the
 * read model handed to the caller (on published periods that is the
 * snapshot-surfaced subset, not the live project rows).
 *
 * All cross-group products collapse into one signal object — the router
 * emits a single event per request, not one per product.
 */
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

/**
 * Snapshot-sourced sibling of `computeCrossGroupSignal`. A published-report
 * read builds its model from the frozen `publishedSnapshot`, so the audit
 * signal must be derived from each surfaced product's owner group as frozen
 * INTO that snapshot — never from a live re-query of current, non-archived
 * projects (a product archived, or whose GroupProduct edge was removed, after
 * publish would otherwise drop out of the live query and silently escape the
 * signal even though the snapshot still delivered it to the caller).
 *
 * `ownerGroupId` is optional/nullable because snapshots frozen before it was
 * introduced omit it; a missing owner cannot be attributed to any group and is
 * never treated as cross-group. Duplicate `projectId`s (a multi-lead product
 * surfacing in two sections) collapse to one entry, matching the distinct-row
 * semantics of the live path.
 */
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
