import type { UserSession } from "@customreport/shared";

/**
 * Phase 46-01 (UFB-040): canonical group-scope filter helper.
 *
 * Returns a Prisma `where` fragment that callsites spread into their own
 * findMany/findFirst queries. The fragment encodes per-role visibility:
 *
 *   - admin    -> {} (no filter; god mode, read+write)
 *   - director -> {} (no filter; god-mode-READ across all groups; UFB-057)
 *                 director is excluded from admin-only mutations upstream
 *                 (adminProcedure), so the empty filter here only opens
 *                 reads — every mutation path still gates on adminProcedure.
 *   - head     -> rows whose owner is in the head's single ReportingGroup
 *   - lead     -> rows whose owner is in the lead's single ReportingGroup
 *   - viewer   -> rows whose owner is in any of the viewer's granted groups
 *                 (viewer with empty access list -> { id: { in: [] } } i.e. zero rows)
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
 *
 * UFB-054 / Phase 56-D: when `target === 'project'`, an optional
 * `useExplicitGroupProducts` flag re-routes the fragment to the
 * explicit `GroupProduct` join table introduced in Phase 56-A. The flag
 * defaults to `false` so every existing call site retains bit-for-bit
 * the legacy behaviour (filter via `Project.lead.reportingGroupId`).
 * Consumers opt in individually (e.g. the head dashboard product list
 * behind a feature flag) once the GroupProduct edges are
 * admin-editable.
 */
export type ScopeTarget = "user" | "reportSection" | "project";

export interface GroupScopeOptions {
  /**
   * UFB-054 / Phase 56-D: only honoured when `target === 'project'`.
   * When `true`, the fragment filters via `groupProducts.some.groupId.in`
   * (the Phase 56-A M:M join) instead of `lead.reportingGroupId.in`.
   *
   * Default `false` so existing call sites keep producing the same SQL
   * as before this flag existed.
   */
  useExplicitGroupProducts?: boolean;
}

export function groupScopeFilter(
  session: UserSession,
  target: ScopeTarget,
  options: GroupScopeOptions = {},
): Record<string, unknown> {
  // UFB-057 / Phase 57: director gets the same empty filter as admin
  // (god-mode-READ). Writes are still gated by `adminProcedure` upstream,
  // so director can read every group's data but cannot mutate it.
  if (session.role === "admin" || session.role === "director") return {};

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
      if (options.useExplicitGroupProducts) {
        // Phase 56-D opt-in: derive product membership from the explicit
        // GroupProduct edge rather than the implicit lead.reportingGroupId
        // path. A product appears in scope when at least one of its
        // GroupProduct rows points at a group the session can see.
        return { groupProducts: { some: { groupId: { in: groupIds } } } };
      }
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
