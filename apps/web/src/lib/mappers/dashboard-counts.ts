/**
 * Per-lead content counters for the head dashboard summary.
 *
 * activity-first-class (Q1): product records and activity records ride the same
 * flat section arrays, discriminated by which parent FK is set. The product
 * summary columns must count ONLY product-parented rows (else activity records
 * inflate them); the activity column counts activity-parented rows. The
 * "has the lead started" signal stays TOTAL so an activity-only lead reads as
 * started.
 */
import type { ReportSectionReadModel } from "@customreport/shared";

/**
 * Total content across product AND activity records. Drives deriveLeadStatus
 * ("has the lead started") — kept total on purpose so an activity-only lead who
 * filled activity records is not misread as "not started".
 */
export function countSectionContent(section: ReportSectionReadModel): number {
  return (
    section.items.length +
    section.risks.length +
    section.decisions.length +
    section.items.filter((i) => i.priorityRank != null).length
  );
}

/** Per-lead PRODUCT work-unit count — product-parented rows only. */
export function countProductContent(section: ReportSectionReadModel): number {
  return (
    section.items.filter((i) => i.projectId != null).length +
    section.risks.filter((r) => r.projectId != null).length +
    section.decisions.filter((d) => d.productId != null).length +
    section.items.filter((i) => i.priorityRank != null && i.projectId != null)
      .length
  );
}

/** Per-lead ACTIVITY work-unit count — records parented to an activity. */
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
 * The five per-lead PRODUCT summary columns, each scoped to product-parented
 * rows (Q1). Extracted so the dashboard `map` callback stays under the
 * cognitive-complexity budget.
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
