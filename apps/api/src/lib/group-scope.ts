import type { UserSession } from "@customreport/shared";

// Prisma where fragment for per-role group visibility. Always a plain object
// (safe to spread). Project ownership uses the explicit GroupProduct M:M edge.
export type ScopeTarget = "user" | "reportSection" | "project";

type GroupScopeSession = Pick<
  UserSession,
  "role" | "reportingGroupId" | "viewerGroupAccess"
>;

export function groupScopeFilter(
  session: GroupScopeSession,
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
      // M:M join: product in scope if any GroupProduct row is visible.
      return { groupProducts: { some: { groupId: { in: groupIds } } } };
  }
}

// Fail loud on missing session (undefined). Defined admin (empty filter =
// full access) is correct and does not throw.
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
export function scopeDiscriminator(session: UserSession): string {
  if (session.role === "admin") return "admin";
  // Default code-unit sort spelled as a comparator: deterministic across
  // locales (localeCompare is not), which the cache key requires.
  return [...computeAllowedGroupIds(session)]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join("|");
}

// Shared source for groupScopeFilter and scopeDiscriminator.
export function computeAllowedGroupIds(
  session: Pick<UserSession, "role" | "reportingGroupId" | "viewerGroupAccess">,
): readonly string[] {
  if (session.role === "head" || session.role === "lead") {
    return session.reportingGroupId ? [session.reportingGroupId] : [];
  }
  if (session.role === "viewer") {
    return session.viewerGroupAccess ?? [];
  }
  return [];
}
