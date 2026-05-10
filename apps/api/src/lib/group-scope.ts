import type { UserSession } from "@customreport/shared";

/**
 * Phase 46-01 (UFB-040): canonical group-scope filter helper.
 *
 * Returns a Prisma `where` fragment that callsites spread into their own
 * findMany/findFirst queries. The fragment encodes per-role visibility:
 *
 *   - admin  -> {} (no filter; god mode)
 *   - head   -> rows whose owner is in the head's single ReportingGroup
 *   - lead   -> rows whose owner is in the lead's single ReportingGroup
 *   - viewer -> rows whose owner is in any of the viewer's granted groups
 *               (viewer with empty access list -> { id: { in: [] } } i.e. zero rows)
 *
 * `target` selects which entity the fragment is being spread into so the
 * helper knows which relation path to filter on:
 *
 *   - 'user'           -> filter on User.reportingGroupId directly
 *   - 'reportSection'  -> filter on ReportSection.author.reportingGroupId
 *   - 'project'        -> filter on Project.lead.reportingGroupId
 *
 * Always returns a plain object so downstream `{ ...other, ...scope }` spreads
 * are safe even when the result is "no filter".
 */
export type ScopeTarget = "user" | "reportSection" | "project";

export function groupScopeFilter(
  session: UserSession,
  target: ScopeTarget,
): Record<string, unknown> {
  if (session.role === "admin") return {};

  const groupIds = computeAllowedGroupIds(session);

  // viewer with no granted access -> zero-row filter so service-layer
  // queries return nothing instead of leaking everything.
  if (groupIds.length === 0) return { id: { in: [] as string[] } };

  switch (target) {
    case "user":
      return { reportingGroupId: { in: groupIds } };
    case "reportSection":
      return { author: { reportingGroupId: { in: groupIds } } };
    case "project":
      return { lead: { reportingGroupId: { in: groupIds } } };
  }
}

function computeAllowedGroupIds(session: UserSession): string[] {
  if (session.role === "head" || session.role === "lead") {
    return session.reportingGroupId ? [session.reportingGroupId] : [];
  }
  if (session.role === "viewer") {
    return session.viewerGroupAccess ?? [];
  }
  return [];
}
