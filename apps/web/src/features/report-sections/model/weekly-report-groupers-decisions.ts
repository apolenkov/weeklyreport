/**
 * Decision/priority grouping + author/escalation lookups for
 * {@link mapWeeklyReport} in `./weekly-report`. Split out from
 * `./weekly-report-groupers` to keep that file focused on the item/risk
 * re-slicing that shares the section-flattening shape.
 */
import type {
  ReportSectionReadModel,
  WeeklyReportReadModel,
} from "@customreport/shared";

import { initialsFromName } from "./weekly-report-groupers";
import type {
  WeeklyReportDecision,
  WeeklyReportPriority,
} from "./weekly-report-types";

type SectionDecision = ReportSectionReadModel["decisions"][number];
type SectionItem = ReportSectionReadModel["items"][number];

interface ResolvedProduct {
  readonly projectId: string;
  readonly projectName: string;
}

/**
 * Resolve the product a decision attaches to: its explicit `productId` when
 * present, else the section author's first project (legacy entries predating
 * per-decision product scoping).
 */
function resolveDecisionProduct(
  section: ReportSectionReadModel,
  projectNames: ReadonlyMap<string, string>,
  decision: SectionDecision,
): ResolvedProduct | undefined {
  if (decision.productId) {
    return {
      projectId: decision.productId,
      projectName: projectNames.get(decision.productId) ?? "Unknown",
    };
  }
  return section.projects.at(0);
}

/** One decision re-shaped into its head-report row; `index` seeds the fallback id. */
function deriveWeeklyReportDecision(
  section: ReportSectionReadModel,
  target: ResolvedProduct,
  decision: SectionDecision,
  index: number,
): WeeklyReportDecision {
  return {
    id: decision.id ?? `decision-${section.reportSectionId}-${index}`,
    badge: target.projectName,
    owner: initialsFromName(section.authorName),
    text: decision.text,
    comments: decision.comments ?? [],
    canReview: section.canReview ?? false,
  };
}

/**
 * Group decisions by their explicit productId when present.
 * Legacy entries without productId fall back to the section author's first
 * project. If neither exists, the entry is dropped (no place to render it).
 *
 * `projectNames` is the report-wide id→name map — see `groupRisksByProject`
 * in `./weekly-report-groupers`.
 */
export function groupDecisionsByProject(
  sections: readonly ReportSectionReadModel[],
  projectNames: ReadonlyMap<string, string>,
): Map<string, WeeklyReportDecision[]> {
  return sections.reduce((map, section) => {
    return section.decisions.reduce((innerMap, decision, idx) => {
      // activity-first-class: activity-parented decisions render under their
      // activity, not a product — skip so they never fall back to firstProject.
      if (decision.activityId != null) return innerMap;
      const target = resolveDecisionProduct(section, projectNames, decision);
      if (!target) return innerMap;
      const list = innerMap.get(target.projectId) ?? [];
      const mapped = deriveWeeklyReportDecision(section, target, decision, idx);
      return new Map(innerMap).set(target.projectId, [...list, mapped]);
    }, map);
  }, new Map<string, WeeklyReportDecision[]>());
}

/**
 * Derive priorities from items with priorityRank set, grouped by projectId,
 * sorted by rank ASC within each product.
 */
export function groupPrioritiesByProject(
  sections: readonly ReportSectionReadModel[],
): Map<string, WeeklyReportPriority[]> {
  return sections.reduce((map, section) => {
    const priorityItems = section.items
      .filter(
        (i): i is SectionItem & { projectId: string } =>
          // activity-first-class: a product priority is product-parented; skip
          // activity items (projectId null).
          i.priorityRank != null && i.projectId != null,
      )
      .sort((a, b) => (a.priorityRank ?? 0) - (b.priorityRank ?? 0));

    return priorityItems.reduce((innerMap, item) => {
      const list = innerMap.get(item.projectId) ?? [];
      return new Map(innerMap).set(item.projectId, [
        ...list,
        { rank: item.priorityRank ?? 1, text: item.text },
      ]);
    }, map);
  }, new Map<string, WeeklyReportPriority[]>());
}

/** Report-wide projectId → the (deduped) list of authors who own it. */
export function buildProductToAuthorMap(
  sections: readonly ReportSectionReadModel[],
): Map<string, string[]> {
  return sections.reduce((map, section) => {
    return section.projects.reduce((innerMap, project) => {
      const authors = innerMap.get(project.projectId) ?? [];
      if (authors.includes(section.authorId)) return innerMap;
      return new Map(innerMap).set(project.projectId, [
        ...authors,
        section.authorId,
      ]);
    }, map);
  }, new Map<string, string[]>());
}

/**
 * Find the first escalation that targets a given product and surface its
 * description as the `needsAttention` banner.
 */
export function findNeedsAttention(
  api: WeeklyReportReadModel,
  productName: string,
): { needsAttention?: string; needsAttentionSeverity?: "blocked" | "at-risk" } {
  const escalation = api.escalations.find((e) => e.productName === productName);
  if (!escalation) return {};
  return {
    needsAttention: escalation.description,
    needsAttentionSeverity:
      escalation.type === "blocked" ? "blocked" : "at-risk",
  };
}
