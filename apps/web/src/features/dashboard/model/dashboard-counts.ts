// Product columns count only product-parented rows (activity rows would
// inflate them); "has the lead started" stays TOTAL so activity-only leads count.
import type {
  ActivityLiveRow,
  ReportSectionReadModel,
} from "@customreport/shared";

/**
 * Count Activity Live Content.
 * @param row - The row argument.
 */
export function countActivityLiveContent(
  row: ActivityLiveRow | undefined,
): number {
  return row
    ? row.itemCount + row.riskCount + row.decisionCount + row.priorityCount
    : 0;
}

// Total across product + activity so an activity-only lead is not "not started".
/**
 * Count Section Content.
 * @param section - The section argument.
 */
export function countSectionContent(section: ReportSectionReadModel): number {
  return (
    section.items.length +
    section.risks.length +
    section.decisions.length +
    section.items.filter((i) => i.priorityRank != null).length
  );
}

/**
 * Count Product Content.
 * @param section - The section argument.
 */
export function countProductContent(section: ReportSectionReadModel): number {
  return (
    section.items.filter((i) => i.projectId != null).length +
    section.risks.filter((r) => r.projectId != null).length +
    section.decisions.filter((d) => d.productId != null).length +
    section.items.filter((i) => i.priorityRank != null && i.projectId != null)
      .length
  );
}

/**
 * Count Activity Records.
 * @param section - The section argument.
 */
export function countActivityRecords(section: ReportSectionReadModel): number {
  return (
    section.items.filter((i) => i.activityId != null).length +
    section.risks.filter((r) => r.activityId != null).length +
    section.decisions.filter((d) => d.activityId != null).length
  );
}

export interface ProductColumnCounts {
  readonly currentItemCount: number;
  readonly nextItemCount: number;
  readonly riskCount: number;
  readonly decisionCount: number;
  readonly priorityCount: number;
}

/**
 * Product Column Counts.
 * @param section - The section argument.
 */
export function productColumnCounts(
  section: ReportSectionReadModel | undefined,
): ProductColumnCounts {
  const productItems = (section?.items ?? []).filter(
    (i) => i.projectId != null,
  );
  return {
    currentItemCount: productItems.filter((i) => i.type === "current").length,
    nextItemCount: productItems.filter((i) => i.type === "next").length,
    riskCount: (section?.risks ?? []).filter((r) => r.projectId != null).length,
    decisionCount: (section?.decisions ?? []).filter((d) => d.productId != null)
      .length,
    priorityCount: productItems.filter((i) => i.priorityRank != null).length,
  };
}
