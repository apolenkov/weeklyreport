import type { ReportSectionReadModel } from "@weeklyreport/shared";

import {
  type ActivityBucket,
  deriveActivityBucket,
} from "../activity/activity-buckets";
import type { UnifiedActivityEntry } from "../activity/unified-activity-entry";
import {
  type CrossAuthorContentRow,
  mapForeignDecisions,
  mapForeignItems,
  mapForeignRisks,
} from "../lead-cross-author-content";
import type { DecisionEntry, KanbanItem, Product, RiskEntry } from "../types";
import type { ReportPeriod } from "../types";

type SectionItem = ReportSectionReadModel["items"][number];

export interface ForeignMergeInput {
  readonly products: readonly Product[];
  readonly ownCurrentWeekItems: readonly KanbanItem[];
  readonly ownNextWeekItems: readonly KanbanItem[];
  readonly ownRisks: readonly RiskEntry[];
  readonly ownDecisions: readonly DecisionEntry[];
  // Full foreign content is gated and remains undefined until requested.
  readonly foreignContent: readonly CrossAuthorContentRow[] | undefined;
  readonly isEveryone: boolean;
  readonly visibilityHydrated: boolean;
  readonly isForeignSlidesDeck: boolean;
}

export interface ForeignMergeResult {
  readonly currentWeekItems: readonly KanbanItem[];
  readonly nextWeekItems: readonly KanbanItem[];
  readonly risks: readonly RiskEntry[];
  readonly decisions: readonly DecisionEntry[];
}

// Everyone merges co-owners' records read-only after hydration on own deck;
// draft-merge strips `.foreign` so they never reach submission.
export function mergeForeignDisplayRecords(
  input: ForeignMergeInput,
): ForeignMergeResult {
  const productNameById = new Map(
    input.products.map((product) => [product.id, product.name]),
  );
  const foreignRows =
    input.isEveryone && input.visibilityHydrated && !input.isForeignSlidesDeck
      ? (input.foreignContent ?? [])
      : [];
  return {
    currentWeekItems: [
      ...input.ownCurrentWeekItems,
      ...mapForeignItems(foreignRows, productNameById, "current"),
    ],
    nextWeekItems: [
      ...input.ownNextWeekItems,
      ...mapForeignItems(foreignRows, productNameById, "next"),
    ],
    risks: [
      ...input.ownRisks,
      ...mapForeignRisks(foreignRows, productNameById),
    ],
    decisions: [
      ...input.ownDecisions,
      ...mapForeignDecisions(foreignRows, productNameById),
    ],
  };
}

// ADR 0015 resolve-not-delete: map published lineage stableIds → on-screen
// row ids so cards can withhold Delete. Advisory; server enforces on save.
export function publishedLockedIds(
  rows: readonly {
    readonly id?: string | null | undefined;
    readonly stableId?: string | null | undefined;
  }[],
  lineageStableIds: readonly string[],
): ReadonlySet<string> {
  const lineage = new Set(lineageStableIds);
  return new Set(
    rows.flatMap((row) =>
      row.id && row.stableId && lineage.has(row.stableId) ? [row.id] : [],
    ),
  );
}

// Foreign rows have no raw draft row; bucket from presentation status.
// The map covers the full ItemStatus vocabulary, so an unknown status is a
// compile error instead of a silent in-progress fallback.
const IN_PROGRESS_BUCKET: ActivityBucket = "in-progress";
const PRESENTATION_STATUS_BUCKETS: Record<
  KanbanItem["status"],
  ActivityBucket
> = {
  "in-progress": IN_PROGRESS_BUCKET,
  completed: "done",
  paused: "paused",
  postponed: "deferred",
  planned: "planned-next",
  blocked: IN_PROGRESS_BUCKET,
  "at-risk": IN_PROGRESS_BUCKET,
};

// Pure projection over raw fields; foreign rows fall back to presentation status.
export function buildUnifiedEntries(
  rawItems: readonly SectionItem[],
  currentWeekItems: readonly KanbanItem[],
  nextWeekItems: readonly KanbanItem[],
): UnifiedActivityEntry[] {
  const rawItemById = new Map(
    rawItems.flatMap((item) => (item.id ? [[item.id, item] as const] : [])),
  );
  const toUnifiedEntry = (
    item: KanbanItem,
    week: "current" | "next",
  ): UnifiedActivityEntry => {
    const raw = item.foreign === true ? undefined : rawItemById.get(item.id);
    if (raw) {
      return {
        item,
        week,
        bucket: deriveActivityBucket({
          type: raw.type,
          workflowStatus: raw.workflowStatus,
          carriedOver: raw.carriedOver,
        }),
      };
    }
    return {
      item,
      week,
      bucket:
        item.status === "planned" && week === "current"
          ? "planned-current"
          : PRESENTATION_STATUS_BUCKETS[item.status],
    };
  };
  return [
    ...currentWeekItems.map((item) => toUnifiedEntry(item, "current")),
    ...nextWeekItems.map((item) => toUnifiedEntry(item, "next")),
  ];
}

export interface VisiblePeriodsResult {
  readonly hasArchivedPeriods: boolean;
  readonly visiblePeriods: ReportPeriod[];
}

// Keep selected archived period visible; never empty the list if all archived.
export function filterVisiblePeriods(
  periods: readonly ReportPeriod[],
  selectedPeriodId: string | null,
  showArchivePeriods: boolean,
): VisiblePeriodsResult {
  const selectedPeriod = selectedPeriodId
    ? periods.find((period) => period.id === selectedPeriodId)
    : undefined;
  const hasArchivedPeriods = periods.some((period) => period.archived);
  const visibleNonArchivedPeriods = periods.filter(
    (period) => !period.archived,
  );
  const visiblePeriods =
    !hasArchivedPeriods ||
    showArchivePeriods ||
    visibleNonArchivedPeriods.length === 0
      ? [...periods]
      : selectedPeriod?.archived
        ? [...visibleNonArchivedPeriods, selectedPeriod]
        : visibleNonArchivedPeriods;
  return { hasArchivedPeriods, visiblePeriods };
}
