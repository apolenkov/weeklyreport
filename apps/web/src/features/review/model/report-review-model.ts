import type {
  PeriodStatus,
  Role,
  WeeklyReportReadModel,
} from "@customreport/shared";

import {
  isAdmin,
  isHeadLike,
  isLead,
} from "../../../shared/lib/auth/role-predicates";
import type { SectionReviewRow } from "./section-review-rows";
import { toSectionReviewRows } from "./section-review-rows";

// Live review surfaces supply this context; print/PDF omits it so reviewer UI
// cannot leak into exports.
export interface AccordionReviewContext {
  readonly currentUserId: string;
  readonly isAdmin: boolean;
  readonly onMutated: () => void;
}

export type CurrentRole = Role | null;

export interface ReviewModel {
  readonly context: AccordionReviewContext | undefined;
  readonly groups: { readonly groupId: string; readonly label: string }[];
  readonly sections: SectionReviewRow[];
  readonly isHeadOrAdmin: boolean;
}

const EMPTY_REVIEW_MODEL: ReviewModel = {
  context: undefined,
  groups: [],
  sections: [],
  isHeadOrAdmin: false,
};

// Live-only reviewer surface, never for a lead or a published snapshot.
export function isReviewEnabled(
  role: CurrentRole,
  periodStatus: PeriodStatus,
): boolean {
  if (role === null || isLead(role)) return false;
  return periodStatus !== "published";
}

export function distinctReviewGroups(
  sections: WeeklyReportReadModel["leadSections"],
): { groupId: string; label: string }[] {
  const labelsByGroupId = new Map<string, string>();
  for (const section of sections) {
    const groupId = section.groupId;
    if (!groupId) continue;
    const label = section.groupName;
    if (!label) throw new Error(`Live review group ${groupId} has no label`);
    const priorLabel = labelsByGroupId.get(groupId);
    if (priorLabel && priorLabel !== label)
      throw new Error(`Live review group ${groupId} has conflicting labels`);
    labelsByGroupId.set(groupId, label);
  }
  return [...labelsByGroupId].map(([groupId, label]) => ({ groupId, label }));
}

// Empty model when review is disabled so the page mounts zero review affordances.
// `canReview` is server-stamped; this only shapes UI, never the security boundary.
export function buildReviewModel(
  reportData: WeeklyReportReadModel,
  params: {
    readonly currentRole: CurrentRole;
    readonly periodStatus: PeriodStatus;
    readonly currentUserId: string | null;
    readonly onMutated: () => void;
  },
): ReviewModel {
  if (
    !isReviewEnabled(params.currentRole, params.periodStatus) ||
    !params.currentUserId
  ) {
    return EMPTY_REVIEW_MODEL;
  }
  const context: AccordionReviewContext = {
    currentUserId: params.currentUserId,
    isAdmin: isAdmin(params.currentRole),
    onMutated: params.onMutated,
  };
  return {
    context,
    groups: distinctReviewGroups(reportData.leadSections),
    sections: toSectionReviewRows(reportData.leadSections),
    isHeadOrAdmin: isHeadLike(params.currentRole),
  };
}
