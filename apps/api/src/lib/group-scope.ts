import type { UserSession } from "@customreport/shared";

/**
 * TODO(Phase-59-multi-org): future extension layer.
 * When Organization stops being a singleton and BusinessUnit is added
 * as an optional cluster between Org and Group, this helper grows a
 * sibling `businessUnitScopeFilter` for the `super_head` role. Today
 * it filters only on ReportingGroup membership; tomorrow it must also
 * narrow by `user.organizationId` and (when applicable) `user.businessUnitId`.
 * See .planning/phases/59-multi-org-hierarchy/59-CONTEXT.md.
 *
 * Phase 46-01 (UFB-040): canonical group-scope filter helper.
 *
 * Returns a Prisma `where` fragment that callsites spread into their own
 * findMany/findFirst queries. The fragment encodes per-role visibility:
 *
 *   - admin    -> {} (no filter; god mode, read+write)
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

/**
 * Defensive assertion: throws a BUG-level error if `session` is undefined.
 * Call at the repository entry point to surface missing-session callers early
 * rather than silently returning unscoped results.
 *
 * Admin sessions legitimately produce an empty `groupScopeFilter` result (no
 * Prisma filter = full access), so passing a defined admin session is correct
 * and will NOT throw. Only `undefined` (no session at all) is rejected.
 */
export function guardGroupScope(
  session: Pick<UserSession, "role"> | undefined,
): void {
  if (session === undefined) {
    throw new Error(
      "[BUG] Repository query called without a scope session — group isolation not enforced.",
    );
  }
}

/**
 * Stable cache-partition key for a session's group scope, derived from the SAME
 * source as {@link groupScopeFilter} so the two can never disagree. `admin` is a
 * distinct literal (unfiltered); every other session maps to its sorted
 * authorised group ids joined by `|` (a delimiter that cannot appear in a UUID,
 * so distinct group sets never collide). A viewer with no access yields `""` —
 * itself a distinct partition from admin and from any granted set.
 *
 * Consumers (e.g. the analytics cache) prepend this to a per-call key so a
 * result computed for one scope is never served from cache to another.
 */
export function scopeDiscriminator(session: UserSession): string {
  if (session.role === "admin") return "admin";
  // eslint-disable-next-line sonarjs/no-alphabetical-sort -- UUID ids; default code-unit sort is deterministic across locales (localeCompare is not), which a cache key requires
  return [...computeAllowedGroupIds(session)].sort().join("|");
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
