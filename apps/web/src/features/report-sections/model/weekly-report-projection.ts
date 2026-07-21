import type {
  PortfolioProductOverview,
  WeeklyReportReadModel,
} from "@customreport/shared";

import { statusLabel } from "../../../lib/status-presentation";
import {
  buildProjectNameMap,
  groupItemsByProject,
  groupRisksByProject,
  initialsFromName,
  statusLabelFor,
  trafficToProductStatus,
} from "./weekly-report-groupers";
import {
  buildProductToAuthorMap,
  findNeedsAttention,
  groupDecisionsByProject,
  groupPrioritiesByProject,
} from "./weekly-report-groupers-decisions";
import type {
  WeeklyPortfolioProduct,
  WeeklyProductReport,
  WeeklyReportDecision,
  WeeklyReportItem,
  WeeklyReportPriority,
  WeeklyReportRisk,
} from "./weekly-report-types";

interface WeeklyItemSlices {
  readonly current: WeeklyReportItem[];
  readonly next: WeeklyReportItem[];
}

export interface WeeklyReportProjectionContext {
  readonly report: WeeklyReportReadModel;
  readonly itemsByProject: ReadonlyMap<string, WeeklyItemSlices>;
  readonly risksByProject: ReadonlyMap<string, WeeklyReportRisk[]>;
  readonly decisionsByProject: ReadonlyMap<string, WeeklyReportDecision[]>;
  readonly prioritiesByProject: ReadonlyMap<string, WeeklyReportPriority[]>;
  readonly authorsByProject: ReadonlyMap<string, string[]>;
}

export interface ProjectedWeeklyProduct {
  readonly portfolio: WeeklyPortfolioProduct;
  readonly product: WeeklyProductReport;
}

export function buildWeeklyReportProjectionContext(
  report: WeeklyReportReadModel,
): WeeklyReportProjectionContext {
  const projectNames = buildProjectNameMap(
    report.leadSections,
    report.portfolioOverview,
  );
  return {
    report,
    itemsByProject: groupItemsByProject(report.leadSections),
    risksByProject: groupRisksByProject(report.leadSections, projectNames),
    decisionsByProject: groupDecisionsByProject(
      report.leadSections,
      projectNames,
    ),
    prioritiesByProject: groupPrioritiesByProject(report.leadSections),
    authorsByProject: buildProductToAuthorMap(report.leadSections),
  };
}

function attentionProperties(
  report: WeeklyReportReadModel,
  productName: string,
): Pick<WeeklyProductReport, "needsAttention" | "needsAttentionSeverity"> {
  const attention = findNeedsAttention(report, productName);
  return {
    ...(attention.needsAttention === undefined
      ? {}
      : { needsAttention: attention.needsAttention }),
    ...(attention.needsAttentionSeverity === undefined
      ? {}
      : { needsAttentionSeverity: attention.needsAttentionSeverity }),
  };
}

export function projectWeeklyProduct(
  overview: PortfolioProductOverview,
  context: WeeklyReportProjectionContext,
): ProjectedWeeklyProduct {
  const status = trafficToProductStatus(overview.worstStatus);
  const items = context.itemsByProject.get(overview.productId) ?? {
    current: [],
    next: [],
  };
  const risks = context.risksByProject.get(overview.productId) ?? [];
  const decisions = context.decisionsByProject.get(overview.productId) ?? [];
  const priorities = context.prioritiesByProject.get(overview.productId) ?? [];
  const leads =
    overview.leadNames.length > 0
      ? overview.leadNames.join(" · ")
      : "unassigned";
  const identity = {
    id: overview.productId,
    initials: initialsFromName(overview.productName),
    name: overview.productName,
    status,
    leads,
  } as const;
  return {
    portfolio: {
      ...identity,
      statusLabel: statusLabelFor(status, overview.leadNames),
      currentWeekCount: items.current.length,
      nextWeekCount: items.next.length,
      riskCount: risks.length,
    },
    product: {
      ...identity,
      authorIds: context.authorsByProject.get(overview.productId) ?? [],
      statusLabel: statusLabel(status, "print"),
      ...attentionProperties(context.report, overview.productName),
      currentWeek: items.current,
      nextWeek: items.next,
      risks,
      decisions,
      priorities,
    },
  };
}
