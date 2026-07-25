import type { ReportSectionReadModel } from "@customreport/shared";

import {
  type ActivityBucket,
  deriveActivityBucket,
} from "../../../lib/activity-buckets";
import {
  type CrossAuthorContentRow,
  type DecisionEntry,
  type KanbanItem,
  mapForeignDecisions,
  mapForeignItems,
  mapForeignRisks,
  type Product,
  type ReportPeriod,
  type RiskEntry,
} from "../../report-sections";
import type { UnifiedActivityEntry } from "./unified-activity-section";

type SectionItem = ReportSectionReadModel["items"][number];

export interface ForeignMergeInput {
  readonly products: readonly Product[];
  readonly ownCurrentWeekItems: KanbanItem[];
  readonly ownNextWeekItems: KanbanItem[];
  readonly ownRisks: RiskEntry[];
  readonly ownDecisions: DecisionEntry[];
  /** Gated Everyone full-content read; undefined while not fetched. */
  readonly foreignContent: readonly CrossAuthorContentRow[] | undefined;
  readonly isEveryone: boolean;
  readonly visibilityHydrated: boolean;
  readonly isForeignSlidesDeck: boolean;
}

export interface ForeignMergeResult {
  readonly currentWeekItems: KanbanItem[];
  readonly nextWeekItems: KanbanItem[];
  readonly risks: RiskEntry[];
  readonly decisions: DecisionEntry[];
}

// Everyone merges co-owners' records read-only after hydration on own deck;
// draft-merge strips `.foreign` so they never reach submission.
/**
 * Merge Foreign Display Records.
 * @param input - The input argument.
 */
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
/**
 * Published Locked Ids.
 * @param rows - The rows argument.
 * @param lineageStableIds - The lineageStableIds argument.
 */
export function publishedLockedIds(
  rows: readonly {
    readonly id?: string | null;
    readonly stableId?: string | null;
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
const PRESENTATION_STATUS_BUCKETS: Partial<
  Record<KanbanItem["status"], ActivityBucket>
> = {
  completed: "done",
  paused: "paused",
  postponed: "deferred",
  planned: "planned-next",
};

// Pure projection over raw fields; foreign rows fall back to presentation status.
/**
 * Build Unified Entries.
 * @param rawItems - The rawItems argument.
 * @param currentWeekItems - The currentWeekItems argument.
 * @param nextWeekItems - The nextWeekItems argument.
 */
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
      bucket: PRESENTATION_STATUS_BUCKETS[item.status] ?? "in-progress",
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
/**
 * Filter Visible Periods.
 * @param periods - The periods argument.
 * @param selectedPeriodId - The selectedPeriodId argument.
 * @param showArchivePeriods - The showArchivePeriods argument.
 */
export function filterVisiblePeriods(
  periods: readonly ReportPeriod[],
  selectedPeriodId: string,
  showArchivePeriods: boolean,
): VisiblePeriodsResult {
  const selectedPeriod = periods.find(
    (period) => period.id === selectedPeriodId && period.id !== "",
  );
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
