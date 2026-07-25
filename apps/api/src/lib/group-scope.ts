import type { UserSession } from "@customreport/shared";

// Prisma where fragment for per-role group visibility. Always a plain object
// (safe to spread). project + useExplicitGroupProducts routes via GroupProduct
// M:M join; default is lead.reportingGroupId.
export type ScopeTarget = "user" | "reportSection" | "project";

export interface GroupScopeOptions {
  // Only for target==='project'; defaults false (lead.reportingGroupId path).
  useExplicitGroupProducts?: boolean;
}

type GroupScopeSession = Pick<
  UserSession,
  "role" | "reportingGroupId" | "viewerGroupAccess"
>;

/**
 * Group Scope Filter.
 * @param session - The session argument.
 * @param target - The target argument.
 * @param options - The options argument.
 */
export function groupScopeFilter(
  session: GroupScopeSession,
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
        // M:M join: product in scope if any GroupProduct row is visible.
        return { groupProducts: { some: { groupId: { in: groupIds } } } };
      }
      return { lead: { reportingGroupId: { in: groupIds } } };
  }
}

// Fail loud on missing session (undefined). Defined admin (empty filter =
// full access) is correct and does not throw.
/**
 * Guard Group Scope.
 * @param session - The session argument.
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

// Same source as groupScopeFilter so cache partitions cannot disagree.
// `|` cannot appear in a UUID; empty string is the no-access partition.
/**
 * Scope Discriminator.
 * @param session - The session argument.
 */
export function scopeDiscriminator(session: UserSession): string {
  if (session.role === "admin") return "admin";
  // eslint-disable-next-line sonarjs/no-alphabetical-sort -- UUID ids; default code-unit sort is deterministic across locales (localeCompare is not), which a cache key requires
  return [...computeAllowedGroupIds(session)].sort().join("|");
}

// Shared source for groupScopeFilter and scopeDiscriminator.
/**
 * Compute Allowed Group Ids.
 * @param session - The session argument.
 */
export function computeAllowedGroupIds(
  session: Pick<UserSession, "role" | "reportingGroupId" | "viewerGroupAccess">,
): string[] {
  if (session.role === "head" || session.role === "lead") {
    return session.reportingGroupId ? [session.reportingGroupId] : [];
  }
  if (session.role === "viewer") {
    return session.viewerGroupAccess ?? [];
  }
  return [];
}
