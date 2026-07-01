import { computeAllowedGroupIds } from "../../lib/group-scope.js";
import type {
  WeeklyReportRepositoryResult,
  WeeklyReportScopeSession,
} from "./weekly-report.service.js";

/**
 * D1: compute the cross-group audit signal from the surfaced projects.
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
 * Per-request dedupe (D3) is achieved by collapsing all cross-group
 * products into one signal object — the router emits a single event.
 */
export function computeCrossGroupSignal(
  session: WeeklyReportScopeSession | undefined,
  projects: { id: string; lead: { reportingGroupId: string | null } | null }[],
): WeeklyReportRepositoryResult["crossGroup"] {
  if (!session || session.role === "admin") return null;

  const allowedGroupIds = computeAllowedGroupIds(session);
  if (allowedGroupIds.length === 0) return null;

  const allowedSet = new Set(allowedGroupIds);
  const crossGroupProductIds: string[] = [];
  const crossGroupGroupIdSet = new Set<string>();

  for (const project of projects) {
    const ownerGroupId = project.lead?.reportingGroupId ?? null;
    if (ownerGroupId !== null && !allowedSet.has(ownerGroupId)) {
      crossGroupProductIds.push(project.id);
      crossGroupGroupIdSet.add(ownerGroupId);
    }
  }

  if (crossGroupProductIds.length === 0) return null;

  return {
    productIds: crossGroupProductIds,
    groupIds: [...crossGroupGroupIdSet],
  };
}
