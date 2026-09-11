import type {
  PortfolioProductOverview,
  WeeklyReportReadModel,
} from "@customreport/shared";
import { shortNameFromName } from "@customreport/shared";

import { statusLabel } from "../../../shared/lib/status/status-presentation";
import { reportHasContent } from "./report-content";
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
  ProductAttention,
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
  productId: string,
): ProductAttention {
  const attention = findNeedsAttention(report, productId);
  const needsAttention = attention.needsAttention;
  const needsAttentionSeverity = attention.needsAttentionSeverity;
  // The pair travels together: text without a severity would be an invented
  // callout, so an incomplete find resolves to the absent branch instead.
  return needsAttention === undefined || needsAttentionSeverity === undefined
    ? {}
    : { needsAttention, needsAttentionSeverity };
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
      ? overview.leadNames.map(shortNameFromName).join(" · ")
      : "unassigned";
  const identity = {
    id: overview.productId,
    initials: initialsFromName(overview.productName),
    name: overview.productName,
    status,
    leads,
  } as const;
  const attention = attentionProperties(context.report, overview.productId);
  const productBase = {
    ...identity,
    authorIds: context.authorsByProject.get(overview.productId) ?? [],
    statusLabel: statusLabel(status, "print"),
    currentWeek: items.current,
    nextWeek: items.next,
    risks,
    decisions,
    priorities,
  };
  // Spread of a union-typed pair loses the discrimination, so the attention
  // fields are appended branch-by-branch to keep the pair atomic.
  const product: WeeklyProductReport =
    attention.needsAttention === undefined
      ? { ...productBase }
      : {
          ...productBase,
          needsAttention: attention.needsAttention,
          needsAttentionSeverity: attention.needsAttentionSeverity,
        };
  return {
    portfolio: {
      ...identity,
      hasContent: reportHasContent(product),
      statusLabel: statusLabelFor(status, overview.leadNames),
      currentWeekCount: items.current.length,
      nextWeekCount: items.next.length,
      riskCount: risks.length,
    },
    product,
  };
}
