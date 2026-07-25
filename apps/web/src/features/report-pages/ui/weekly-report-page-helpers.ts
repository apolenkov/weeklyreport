import type {
  PeriodStatus,
  ReportSectionReadModel,
  Role,
  WeeklyReportReadModel,
} from "@customreport/shared";

import { getClientErrorDetails } from "../../../lib/client-error-reporting";
import { isAdmin, isHeadLike, isLead } from "../../../lib/role-predicates";
import {
  mapWeeklyReport,
  mapWeeklyReportLeadGroups,
  reportHasContent,
  type WeeklyProductReport,
} from "../../report-sections";
import type { SectionReviewRow } from "../../review";
import { toSectionReviewRows } from "../../review";
import type { AccordionReviewContext } from "./product-accordion";

export interface TerminalNotice {
  readonly title: string;
  readonly body: string;
}

// Terminal display after loading: invalid-link (400/404) vs no active period.
// Transient 5xx / network errors fall through to no-period.
export function resolveTerminalNotice(query: {
  readonly isError: boolean;
  readonly error: unknown;
  readonly data: { readonly status: string } | undefined;
}): TerminalNotice | null {
  if (query.isError && getClientErrorDetails(query.error).isInvalidLink) {
    return {
      title: "Report not found",
      body: "This link is invalid or the report no longer exists.",
    };
  }
  if (!query.data || query.data.status === "no-period") {
    return {
      title: "No active reporting period",
      body: "Ask an admin to open a new period to start collecting status reports.",
    };
  }
  return null;
}

export type CurrentRole = Role | null;

export interface ReviewModel {
  readonly context: AccordionReviewContext | undefined;
  readonly groups: { readonly groupId: string }[];
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

function distinctReviewGroups(
  sections: WeeklyReportReadModel["leadSections"],
): { groupId: string }[] {
  const ids = sections
    .map((section) => section.groupId)
    .filter((groupId): groupId is string => Boolean(groupId));
  return [...new Set(ids)].map((groupId) => ({ groupId }));
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

export interface LeadGroup {
  id: string;
  name: string;
  products: WeeklyProductReport[];
}

export interface AccordionModel {
  readonly products: WeeklyProductReport[];
  readonly leadGroups: LeadGroup[];
  // Any section (submitted OR draft) carries content — "truly empty period" gate.
  readonly hasAnyContent: boolean;
  // Draft sections that DO carry content (empty drafts hide nothing → excluded).
  readonly draftCount: number;
}

// Touched activity = alarm (yellow/red), note, or owned records. GREEN alone
// does not count: seed defaults every attached activity to green on create.
// Without the fold an all-activity period would read empty and could not publish.
function sectionHasActivityContent(
  // Optional so a pre-activity fixture omitting it is no-activity, not a crash.
  section: Pick<ReportSectionReadModel, "items" | "risks" | "decisions"> & {
    readonly activities?: ReportSectionReadModel["activities"];
  },
): boolean {
  const activities = section.activities ?? [];
  if (activities.length === 0) return false;
  const ownsRecord = (activityId: string): boolean =>
    section.items.some((i) => i.activityId === activityId) ||
    section.risks.some((r) => r.activityId === activityId) ||
    section.decisions.some((d) => d.activityId === activityId);
  return activities.some((a) => {
    const alarm = a.derivedStatus ?? a.status;
    if (alarm === "yellow" || alarm === "red") return true;
    if (a.note != null && a.note.trim() !== "") return true;
    return ownsRecord(a.activityId);
  });
}

// Shared submitted-only predicate for every surface that narrows with the filter.
export const isSubmittedSection = (section: {
  readonly status: "draft" | "submitted";
}): boolean => section.status === "submitted";

// Same per-lead grouping as mapWeeklyReportLeadGroups, scoped to one section.
function sectionHasProductContent(
  section: ReportSectionReadModel,
  reportData: WeeklyReportReadModel,
): boolean {
  return (
    mapWeeklyReportLeadGroups({ ...reportData, leadSections: [section] })
      .length > 0
  );
}

// Shape the accordion BODY for submitted/all. fullProducts/fullLeadGroups stay
// the truth source (header, portfolio, period nav). Filtering is render-layer
// only — never the server query, read gate, or group scope.
export function buildAccordionModel(params: {
  readonly reportData: WeeklyReportReadModel;
  readonly scope: "product" | "lead";
  readonly submittedOnly: boolean;
  readonly fullProducts: WeeklyProductReport[];
  readonly fullLeadGroups: LeadGroup[];
}): AccordionModel {
  const { reportData, scope, submittedOnly, fullProducts, fullLeadGroups } =
    params;
  // Product content OR a touched activity (an all-activity period is real content).
  const hasAnyContent =
    fullProducts.some(reportHasContent) ||
    reportData.leadSections.some(sectionHasActivityContent);
  if (!submittedOnly) {
    return {
      products: fullProducts,
      leadGroups: fullLeadGroups,
      hasAnyContent,
      draftCount: 0,
    };
  }
  const submittedData: WeeklyReportReadModel = {
    ...reportData,
    leadSections: reportData.leadSections.filter(isSubmittedSection),
  };
  const draftSections = reportData.leadSections.filter(
    (section) => !isSubmittedSection(section),
  );
  const products =
    mapWeeklyReport(submittedData).products.filter(reportHasContent);
  const leadGroups =
    scope === "lead" ? mapWeeklyReportLeadGroups(submittedData) : [];
  // Count product OR activity content so activity-only drafts stay visible.
  const draftCount = draftSections.filter(
    (section) =>
      sectionHasProductContent(section, reportData) ||
      sectionHasActivityContent(section),
  ).length;
  return {
    products,
    leadGroups,
    hasAnyContent,
    draftCount,
  };
}
