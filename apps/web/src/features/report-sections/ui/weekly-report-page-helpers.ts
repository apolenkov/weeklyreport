import type {
  ReportSectionReadModel,
  Role,
  WeeklyReportReadModel,
} from "@customreport/shared";

import { getClientErrorDetails } from "../../../lib/client-error-reporting";
import { isAdmin, isHeadLike, isLead } from "../../../lib/role-predicates";
import type { SectionReviewRow } from "../../review";
import { toSectionReviewRows } from "../../review";
import { reportHasContent } from "../model/report-content";
import {
  mapWeeklyReport,
  mapWeeklyReportLeadGroups,
} from "../model/weekly-report";
import type { WeeklyProductReport } from "../model/weekly-report-types";
import type { AccordionReviewContext } from "./product-accordion";

export interface TerminalNotice {
  readonly title: string;
  readonly body: string;
}

/**
 * Resolves the page's terminal display state (after loading settles).
 *  - invalid-link: a malformed reportId (400 BAD_REQUEST) or a missing report
 *    (404 NOT_FOUND). Transient 5xx / network errors fall through to no-period.
 *  - no active period: no data, or a `no-period` status.
 * Returns null when the report should render normally.
 */
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
export type LivePeriodStatus = "open" | "published" | "reopened";

export interface ReviewModel {
  readonly context: AccordionReviewContext | undefined;
  readonly groups: { readonly groupId: string }[];
  readonly sections: SectionReviewRow[];
  readonly isHeadOrAdmin: boolean;
}

export const EMPTY_REVIEW_MODEL: ReviewModel = {
  context: undefined,
  groups: [],
  sections: [],
  isHeadOrAdmin: false,
};

/**
 * The reviewer surface is live-only and never for a lead: any access-holder
 * (head/admin/viewer) on an `open`/`reopened` period, never on a published
 * snapshot.
 */
export function isReviewEnabled(
  role: CurrentRole,
  periodStatus: LivePeriodStatus,
): boolean {
  if (role === null || isLead(role)) return false;
  return periodStatus !== "published";
}

/** Distinct non-null author groups in the report (the Acknowledge group set). */
export function distinctReviewGroups(
  sections: WeeklyReportReadModel["leadSections"],
): { groupId: string }[] {
  const ids = sections
    .map((section) => section.groupId)
    .filter((groupId): groupId is string => Boolean(groupId));
  return [...new Set(ids)].map((groupId) => ({ groupId }));
}

/**
 * review-acknowledgement (§6): derive the in-app reviewer surface from the live
 * read model. Returns an empty model when review is disabled — a lead, an
 * anonymous caller, or a published period — so the page renders zero review
 * affordances there. `canReview` is server-stamped; this only shapes the
 * affordances, never the security boundary.
 */
export function buildReviewModel(
  reportData: WeeklyReportReadModel,
  params: {
    readonly currentRole: CurrentRole;
    readonly periodStatus: "open" | "published" | "reopened";
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
  /** Any section (submitted OR draft) carries content — the "truly empty period" gate. */
  readonly hasAnyContent: boolean;
  /** Draft sections that DO carry content (empty drafts hide nothing → excluded). */
  readonly draftCount: number;
}

/**
 * activity-first-class: a section carries activity content when a lead has
 * TOUCHED an attached activity — deliberately raised its alarm (yellow/red),
 * authored a note, or parented ≥1 record to it. A GREEN status does NOT count:
 * `seedActivityStatuses` defaults every attached activity to green on section
 * create (never null), so a non-null status is not evidence of lead input.
 * Mirrors reportHasContent's strictness (a green product status is not content):
 * a merely-provisioned activity must not defeat the "truly empty period"
 * empty-state. Without the fold an all-activity period (real activity content,
 * zero product content) would read "No submissions yet" and could not publish.
 */
export function sectionHasActivityContent(
  // `activities` is optional here (unlike the strict read model) so a legacy /
  // pre-activity fixture section that omits it is treated as no-activity, not a
  // crash — the same tolerance ActivityStatusStrip applies.
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

/**
 * review-acknowledgement (§7): THE submitted-only predicate. Every render
 * surface that narrows with the filter (accordion body, Project Activities
 * strip) must share it so no draft content leaks through one of them.
 */
export const isSubmittedSection = (section: {
  readonly status: "draft" | "submitted";
}): boolean => section.status === "submitted";

/**
 * A single draft section's canonical product-content check: run the SAME
 * per-lead grouping `mapWeeklyReportLeadGroups` uses, scoped to just this one
 * section, so a section counts as carrying product content exactly when it
 * would produce a non-empty group on its own — no duplicated grouping logic,
 * no divergence from the canonical product-content rule.
 */
function sectionHasProductContent(
  section: ReportSectionReadModel,
  reportData: WeeklyReportReadModel,
): boolean {
  return (
    mapWeeklyReportLeadGroups({ ...reportData, leadSections: [section] })
      .length > 0
  );
}

/**
 * review-acknowledgement (§7): shape the accordion BODY for the submitted/all
 * filter. `fullProducts` / `fullLeadGroups` are the truth source (header counts,
 * portfolio band, and period nav read them). When submitted-only is active we
 * re-map the submitted-only sections into a filtered view and count the draft
 * sections that still carry content, so an all-draft period surfaces a "N in
 * draft — Show all" signal instead of a misleading empty accordion. Filtering
 * happens at the render layer only — never the server query, read gate, or group
 * scope.
 */
export function buildAccordionModel(params: {
  readonly reportData: WeeklyReportReadModel;
  readonly scope: "product" | "lead";
  readonly submittedOnly: boolean;
  readonly fullProducts: WeeklyProductReport[];
  readonly fullLeadGroups: LeadGroup[];
}): AccordionModel {
  const { reportData, scope, submittedOnly, fullProducts, fullLeadGroups } =
    params;
  // Full-truth "truly empty period" gate: product content on any section, OR a
  // touched activity on any section (activity-first-class — an all-activity
  // period is real content and must render + be publishable, not read empty).
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
  // A draft section counts toward "N in draft" when it carries product
  // content OR activity content (mirroring hasAnyContent's product-OR-activity
  // fold above) — an activity-only draft section must not be invisible to the
  // count just because mapWeeklyReportLeadGroups only sees product content.
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
