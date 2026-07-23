import type { PeriodStatus, UserSession } from "@customreport/shared";

import { computeAllowedGroupIds } from "../../../lib/group-scope.js";

// Session fields the review authz decisions read. Narrowed so callers (and
// tests) can pass a partial session.
export type ReviewSession = Pick<
  UserSession,
  "userId" | "role" | "reportingGroupId" | "viewerGroupAccess"
>;

/**
 * Acknowledgement authorization: the caller's group scope must COVER the target
 * group. Non-admin scope comes from `computeAllowedGroupIds`; admin coverage is
 * this function's short-circuit, matching `groupScopeFilter`'s unfiltered admin
 * branch. Requires only access — never the reviewer designation.
 */
export function scopeCoversGroup(
  session: ReviewSession,
  groupId: string,
): boolean {
  if (session.role === "admin") return true;
  return computeAllowedGroupIds(session).includes(groupId);
}

/**
 * Reviewer-designation decision for the SECTION'S group. Head of that group and
 * admin are reviewers implicitly; a viewer must carry `canReview = true` on the
 * `ViewerGroupAccess` row for THAT group (`canReviewFlag`, resolved by the
 * repository). Keyed strictly on the target group — never "any group the caller
 * can review" — so designation never crosses groups.
 */
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
