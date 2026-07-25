import type {
  MyHistoryEntry,
  ReportSectionReadModel,
} from "@customreport/shared";

import { deriveActivityAlarmFloor } from "../../../lib/activity-alarm";
import {
  applyCrossAuthorStageOverrides,
  buildCrossAuthorStageMap,
  type CrossAuthorContentRow,
  type CrossAuthorRow,
  type DecisionEntry,
  type KanbanItem,
  type LeadActivityCard,
  type LeadCurrentUser,
  mapLeadFormData,
  type Product,
  type ReportPeriod,
  type RiskEntry,
} from "../../report-sections";
import {
  buildUnifiedEntries,
  filterVisiblePeriods,
  mergeForeignDisplayRecords,
  publishedLockedIds,
} from "./lead-form-loaded-view-model-helpers";
import type { UnifiedActivityEntry } from "./unified-activity-section";

/**
 * Already-loaded query/draft inputs the pure builder projects from. The
 * boundary owns no React state, effects, routes, or queries — LeadForm
 * gathers these after its skeleton guard and consumes the returned model.
 */
export interface LeadFormLoadedInput {
  /** `reports.getActive` result (the draft section stands in when null). */
  readonly active: ReportSectionReadModel;
  /** The editable draft mirror of the loaded section. */
  readonly draftSection: ReportSectionReadModel;
  /** `leadForm.byPeriod` lock flag for the loaded period. */
  readonly serverReadOnly: boolean;
  /** Server-computed reopen affordance — never reconstructed client-side. */
  readonly canRequestReopen: boolean;
  /** Durable published stableId lineage from `leadForm.byPeriod`. */
  readonly publishedLineage: {
    readonly itemStableIds: readonly string[];
    readonly decisionStableIds: readonly string[];
  };
  readonly history: readonly MyHistoryEntry[];
  /** Status-only cross-author read — always fetched, drives stage chips. */
  readonly crossAuthors: readonly CrossAuthorRow[];
  /** Gated Everyone full-content read; undefined while not fetched. */
  readonly foreignContent: readonly CrossAuthorContentRow[] | undefined;
  readonly isEveryone: boolean;
  readonly visibilityHydrated: boolean;
  readonly isForeignSlidesDeck: boolean;
  /** Client-side submitted state from draft orchestration. */
  readonly isSubmitted: boolean;
  readonly selectedPeriodId: string;
  readonly showArchivePeriods: boolean;
}

/** The loaded display model LeadForm renders from. */
export interface LeadFormLoadedViewModel {
  readonly products: Product[];
  /** The author's attached activities offered as record parents. */
  readonly activityOptions: readonly { id: string; name: string }[];
  readonly ownCurrentWeekItems: KanbanItem[];
  readonly ownNextWeekItems: KanbanItem[];
  readonly ownRisks: RiskEntry[];
  readonly ownDecisions: DecisionEntry[];
  readonly activityCards: LeadActivityCard[];
  readonly currentWeekItems: KanbanItem[];
  readonly nextWeekItems: KanbanItem[];
  readonly risks: RiskEntry[];
  readonly decisions: DecisionEntry[];
  readonly ownPeriodRanks: readonly number[];
  readonly publishedLockedItemIds: ReadonlySet<string>;
  readonly publishedLockedDecisionIds: ReadonlySet<string>;
  readonly fillFromLocked: boolean;
  readonly unifiedEntries: UnifiedActivityEntry[];
  readonly currentUser: LeadCurrentUser;
  readonly canRequestReopen: boolean;
  readonly hasArchivedPeriods: boolean;
  readonly visiblePeriods: ReportPeriod[];
  readonly isReadOnly: boolean;
}

/**
 * Pure projection of the loaded lead-form state into its display model.
 * Behavior contract (see openspec/specs/lead-form-loaded-view-model):
 * cross-author Everyone gating, own-only write arrays, published-lineage
 * locks, unified activity buckets, activity alarm floors, and archived-period
 * visibility all preserve the pre-extraction LeadForm semantics.
 * @param input - The input argument.
 */
export function buildLeadFormLoadedViewModel(
  input: LeadFormLoadedInput,
): LeadFormLoadedViewModel {
  const { draftSection } = input;
  // Map raw draft state -> Lead* presentation shapes for existing children.
  const data = mapLeadFormData({
    active: input.active,
    byPeriod: {
      section: draftSection,
      readOnly: input.serverReadOnly,
      canRequestReopen: input.canRequestReopen,
    },
    history: input.history,
  });

  // Foreign stage CHIPS show only in Everyone: the override fills the
  // cross-author initials + risk-derived status onto foreign-owned (locked)
  // stages. In Mine only the override is skipped so co-owners' stages stay
  // hidden. Product HEALTH stays honest in BOTH states — it derives from the
  // always-fetched status read inside SdlcPipeline, independent of these chips.
  const products = input.isEveryone
    ? applyCrossAuthorStageOverrides(
        data.products,
        buildCrossAuthorStageMap(input.crossAuthors),
      )
    : data.products;

  // activity-first-class: the author's attached activities offered as record
  // parents in the item/risk dialogs (id + display name only).
  const activityOptions = draftSection.activities.map((activity) => ({
    id: activity.activityId,
    name: activity.activityName,
  }));

  const ownCurrentWeekItems: KanbanItem[] = data.currentWeekItems;
  const ownNextWeekItems: KanbanItem[] = data.nextWeekItems;
  const ownRisks = data.risks;
  const ownDecisions = data.decisions;

  // The interactive pill's alarm floor re-derived from the LIVE draft risks
  // (the server-baked alarmFloor goes stale the moment a draft risk is added
  // or removed — no refetch mid-edit). Read-only surfaces keep the server value.
  const activityCards = data.activityCards.map((card) => ({
    ...card,
    alarmFloor: deriveActivityAlarmFloor(card.activityId, ownRisks),
  }));

  const { currentWeekItems, nextWeekItems, risks, decisions } =
    mergeForeignDisplayRecords({
      products,
      ownCurrentWeekItems,
      ownNextWeekItems,
      ownRisks,
      ownDecisions,
      foreignContent: input.foreignContent,
      isEveryone: input.isEveryone,
      visibilityHydrated: input.visibilityHydrated,
      isForeignSlidesDeck: input.isForeignSlidesDeck,
    });

  // Priority ranks already assigned to own (non-foreign) items for the whole
  // period, so the edit dialog can disable taken ranks. Foreign items are
  // intentionally excluded — read-only rows cannot be edited.
  const ownPeriodRanks = [...ownCurrentWeekItems, ...ownNextWeekItems]
    .map((item) => item.priorityRank)
    .filter((rank): rank is number => rank != null);

  // A reopened period's section still carries published-lineage records, so
  // the server's fillFrom guard rejects every source. Mirror the RAW lineage
  // check to disable the control instead of offering an action that always
  // fails; the server guard stays the enforcement point.
  const fillFromLocked =
    input.publishedLineage.itemStableIds.length > 0 ||
    input.publishedLineage.decisionStableIds.length > 0;

  const { hasArchivedPeriods, visiblePeriods } = filterVisiblePeriods(
    data.periods,
    input.selectedPeriodId,
    input.showArchivePeriods,
  );

  return {
    products,
    activityOptions,
    ownCurrentWeekItems,
    ownNextWeekItems,
    ownRisks,
    ownDecisions,
    activityCards,
    currentWeekItems,
    nextWeekItems,
    risks,
    decisions,
    ownPeriodRanks,
    publishedLockedItemIds: publishedLockedIds(
      draftSection.items,
      input.publishedLineage.itemStableIds,
    ),
    publishedLockedDecisionIds: publishedLockedIds(
      draftSection.decisions,
      input.publishedLineage.decisionStableIds,
    ),
    fillFromLocked,
    unifiedEntries: buildUnifiedEntries(
      draftSection.items,
      currentWeekItems,
      nextWeekItems,
    ),
    currentUser: data.currentUser,
    canRequestReopen: data.canRequestReopen,
    hasArchivedPeriods,
    visiblePeriods,
    isReadOnly: data.readOnly || input.isSubmitted,
  };
}
