import {
  buildEscalationsFromReadSections,
  buildPortfolioProductsFromSnapshotSections,
  type ReportSectionReadModel,
  type ReportSectionStatus,
  type WeeklyReportReadModel,
} from "@weeklyreport/shared";

import { getClientErrorDetails } from "../../../../shared/lib/errors/client-error-reporting";
import {
  mapWeeklyReport,
  mapWeeklyReportLeadGroups,
  reportHasContent,
  type WeeklyProductReport,
} from "../../../report-sections";

export interface TerminalNotice {
  readonly title: string;
  readonly body: string;
}

// Terminal display after loading: invalid-link (400/404), transient failure
// (5xx/network), or no active period — each is its own notice, so a failed
// fetch is never rendered as "no active period".
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
  if (query.isError) {
    return {
      title: "Report could not be loaded",
      body: "A temporary problem prevented loading this report. Refresh the page to try again.",
    };
  }
  if (query.data?.status === "no-period") {
    return {
      title: "No active reporting period",
      body: "Ask an admin to open a new period to start collecting status reports.",
    };
  }
  return null;
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
// Without the fold an activity-only period would render as empty.
function sectionHasActivityContent(
  section: Pick<
    ReportSectionReadModel,
    "items" | "risks" | "decisions" | "activities"
  >,
): boolean {
  const activities = section.activities;
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
  readonly status: ReportSectionStatus;
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
  const submittedSections = reportData.leadSections.filter(isSubmittedSection);
  const submittedData: WeeklyReportReadModel = {
    ...reportData,
    leadSections: submittedSections,
    escalations: buildEscalationsFromReadSections(submittedSections),
    portfolioOverview:
      buildPortfolioProductsFromSnapshotSections(submittedSections),
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
