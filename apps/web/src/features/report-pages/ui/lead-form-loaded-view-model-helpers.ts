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

/**
 * Everyone merges co-owners' full records READ-ONLY on top of the lead's own
 * records, from the gated full-content read — only when the persisted toggle
 * has hydrated AND the deck is the lead's own (foreign rows are excluded at
 * BOTH the fetch and this merge). The merge is view-only: the draft-merge
 * handlers strip every `.foreign` row, so it never reaches the submission.
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

/**
 * Resolve-not-delete (ADR 0015): translate the server's published lineage
 * (durable stableIds) into the presentation row ids currently on screen, so
 * the cards can mark locked records and withhold Delete. Advisory only —
 * the save-path guard on the server is the enforcement point.
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

/**
 * Fallback buckets for rows without a raw draft row (foreign read-only
 * rows): the bucket derives from the presentation status. Statuses outside
 * the map (`in-progress`, the risk-derived `blocked` overlay) read as
 * in-progress work.
 */
const PRESENTATION_STATUS_BUCKETS: Partial<
  Record<KanbanItem["status"], ActivityBucket>
> = {
  completed: "done",
  paused: "paused",
  postponed: "deferred",
  planned: "planned-next",
};

/**
 * Unified by-state entries: each displayed item plus its derived bucket
 * (deriveActivityBucket over the RAW persisted fields — a pure projection;
 * Item.type storage is untouched). Foreign read-only rows have no raw row
 * in the draft, so their bucket derives from the presentation status.
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

/**
 * Archived periods hide behind the archive toggle, with two stability rules:
 * the currently selected archived period stays visible (the navigator must
 * render "where you are"), and hiding never empties the list — when every
 * period is archived the full list shows instead.
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
