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
  const entries = sections.flatMap((section) =>
    // Activity-parented decisions render under their activity, not a product —
    // skipped so they never fall back to firstProject. `idx` is the decision's
    // ordinal within its section (seeds the fallback id).
    section.decisions.flatMap((decision, idx) => {
      if (decision.activityId != null) return [];
      const target = resolveDecisionProduct(section, projectNames, decision);
      if (!target) return [];
      return [{ section, target, decision, idx }];
    }),
  );

  return new Map(
    [...Map.groupBy(entries, (entry) => entry.target.projectId)].map(
      ([projectId, group]) => [
        projectId,
        group.map((entry) =>
          deriveWeeklyReportDecision(
            entry.section,
            entry.target,
            entry.decision,
            entry.idx,
          ),
        ),
      ],
    ),
  );
}

/**
 * Derive priorities from items with priorityRank set, grouped by projectId,
 * sorted by rank ASC within each product.
 */
export function groupPrioritiesByProject(
  sections: readonly ReportSectionReadModel[],
): Map<string, WeeklyReportPriority[]> {
  // Each section's priority items are rank-sorted, then concatenated in section
  // order — a product owned by two sections keeps each section's sorted block.
  const entries = sections.flatMap((section) =>
    section.items
      .filter(
        (
          i,
        ): i is SectionItem & {
          projectId: string;
          priorityRank: number;
        } =>
          // A product priority is product-parented; skip activity items
          // (projectId null).
          i.priorityRank != null && i.projectId != null,
      )
      .toSorted((a, b) => a.priorityRank - b.priorityRank),
  );

  return new Map(
    [...Map.groupBy(entries, (item) => item.projectId)].map(
      ([projectId, items]) => [
        projectId,
        items.map((item) => ({
          rank: item.priorityRank,
          text: item.text,
        })),
      ],
    ),
  );
}

/** Report-wide projectId → the (deduped) list of authors who own it. */
export function buildProductToAuthorMap(
  sections: readonly ReportSectionReadModel[],
): Map<string, string[]> {
  const entries = sections.flatMap((section) =>
    section.projects.map((project) => ({
      projectId: project.projectId,
      authorId: section.authorId,
    })),
  );

  return new Map(
    [...Map.groupBy(entries, (entry) => entry.projectId)].map(
      ([projectId, group]) => [
        projectId,
        // Dedupe authors, keeping first-owning-section order.
        [...new Set(group.map((entry) => entry.authorId))],
      ],
    ),
  );
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
