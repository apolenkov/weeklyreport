import type { PeriodStatus, UserSession } from "@weeklyreport/shared";

import { computeAllowedGroupIds } from "../../../lib/group-scope.js";

// Session fields the review authz decisions read. Narrowed so callers (and
// tests) can pass a partial session.
export type ReviewSession = Pick<
  UserSession,
  "userId" | "role" | "reportingGroupId" | "viewerGroupAccess"
>;

// Scope must COVER the target group. Admin short-circuits (matches groupScopeFilter);
// non-admin uses computeAllowedGroupIds. Access only — never reviewer designation.
export function scopeCoversGroup(
  session: ReviewSession,
  groupId: string,
): boolean {
  if (session.role === "admin") return true;
  return computeAllowedGroupIds(session).includes(groupId);
}

// Designation for the SECTION's group only — never "any group the caller can
// review". Head/admin implicit; viewer needs canReview on that group's access row.
export function isDesignatedReviewer(
  session: ReviewSession,
  groupId: string,
  canReviewFlag: boolean,
): boolean {
  if (session.role === "admin") return true;
  if (session.role === "head") return session.reportingGroupId === groupId;
  if (session.role === "viewer") return canReviewFlag;
  return false;
}

// A period accepts a verdict / un-submit only while it is editable — `open` or
// `reopened`, and not archived. A published or archived period is reached only
// through a period-level reopen first.
export function isEditablePeriod(period: {
  periodStatus: PeriodStatus;
  archived: boolean;
}): boolean {
  if (period.archived) return false;
  return period.periodStatus === "open" || period.periodStatus === "reopened";
}
