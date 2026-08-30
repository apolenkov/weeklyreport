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

// Decisions are grouped only when their current record carries a product parent.
function resolveDecisionProduct(
  projectNames: ReadonlyMap<string, string>,
  decision: SectionDecision,
): ResolvedProduct | undefined {
  if (decision.productId) {
    return {
      projectId: decision.productId,
      projectName: projectNames.get(decision.productId) ?? "Unknown",
    };
  }
  return undefined;
}

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

// Product-parented decisions only; activity-parented decisions render in their
// activity lane and parentless records are rejected as invalid input.
export function groupDecisionsByProject(
  sections: readonly ReportSectionReadModel[],
  projectNames: ReadonlyMap<string, string>,
): Map<string, WeeklyReportDecision[]> {
  const entries = sections.flatMap((section) =>
    // Activity-parented decisions skip product fallback (render under activity).
    section.decisions.flatMap((decision, idx) => {
      if (decision.activityId != null) return [];
      const target = resolveDecisionProduct(projectNames, decision);
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

// Priorities from items with priorityRank, grouped by project, rank ASC.
export function groupPrioritiesByProject(
  sections: readonly ReportSectionReadModel[],
): Map<string, WeeklyReportPriority[]> {
  // Rank-sorted per section, then concatenated — dual-owned products keep blocks.
  const entries = sections.flatMap((section) =>
    section.items
      .filter(
        (
          i,
        ): i is SectionItem & {
          projectId: string;
          priorityRank: number;
        } =>
          // Product-parented only; skip activity items (projectId null).
          i.priorityRank != null && i.projectId != null,
      )
      .toSorted((a, b) => a.priorityRank - b.priorityRank),
  );

  return new Map(
    [...Map.groupBy(entries, (item) => item.projectId)].map(
      ([projectId, items]) => [
        projectId,
        items.map((item) => {
          if (item.id === undefined) {
            throw new Error("Priority item is missing its persisted id");
          }
          return { id: item.id, rank: item.priorityRank, text: item.text };
        }),
      ],
    ),
  );
}

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
        [...new Set(group.map((entry) => entry.authorId))],
      ],
    ),
  );
}

// First escalation targeting the product, surfaced as the needsAttention banner.
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
