import type { Role } from "@customreport/shared";

import {
  isHead,
  isHeadLike,
  isLead as isLeadRole,
  isViewer,
} from "../../../lib/role-predicates";
import type { SearchScope } from "../../../shared/ui/search-input-utils";

// Search reach per role: a lead sees only their own sections, head-like roles
// see everything, and a viewer is confined to published, group-scoped content.
// A role with no history surface gets null and no search box at all.
/**
 * History Search Scope.
 * @param role - The role argument.
 */
export function historySearchScope(role: Role | null): SearchScope | null {
  if (isLeadRole(role)) return "mine";
  if (isHeadLike(role)) return "all";
  if (isViewer(role)) return "published";
  return null;
}

/**
 * History Search Placeholder.
 * @param role - The role argument.
 */
export function historySearchPlaceholder(role: Role | null): string {
  if (isLeadRole(role)) return "Search my reports…";
  if (isViewer(role)) return "Search published reports…";
  return "Search reports and products…";
}

/**
 * History Subtitle.
 * @param role - The role argument.
 */
export function historySubtitle(role: Role | null): string {
  if (isLeadRole(role)) return "Your report history.";
  if (isHead(role)) return "Compiled group report history.";
  if (isViewer(role)) return "Published report history.";
  return "Compiled report history.";
}
