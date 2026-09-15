import type {
  MyHistoryEntry,
  PublishedLineage,
  ReportSectionReadModel,
} from "@customreport/shared";

import { activityDisplayTitle } from "../../../../shared/lib/activity/activity-display";
import type { UnifiedActivityEntry } from "../activity/unified-activity-entry";
import { deriveActivityAlarmFloor } from "../alarms/activity-alarm";
import type { CrossAuthorRow } from "../lead-cross-author";
import {
  applyCrossAuthorStageOverrides,
  buildCrossAuthorStageMap,
} from "../lead-cross-author";
import type { CrossAuthorContentRow } from "../lead-cross-author-content";
import {
  type LeadActivityCard,
  type LeadCurrentUser,
  mapLeadFormData,
  type MappedLeadForm,
} from "../lead-form";
import type {
  DecisionEntry,
  KanbanItem,
  Product,
  ReportPeriod,
  RiskEntry,
} from "../types";
import {
  buildUnifiedEntries,
  filterVisiblePeriods,
  type ForeignMergeResult,
  mergeForeignDisplayRecords,
  publishedLockedIds,
} from "./lead-form-loaded-view-model-helpers";

// Pure projection input; LeadForm supplies settled query/draft data after its
// skeleton guard, so this boundary owns no React state, effects, or routing.
export interface LeadFormLoadedInput {
  readonly active: ReportSectionReadModel;
  readonly draftSection: ReportSectionReadModel;
  readonly serverReadOnly: boolean;
  // Server-computed; the client must not reconstruct reopen policy.
  readonly canRequestReopen: boolean;
  readonly publishedLineage: PublishedLineage;
  readonly history: readonly MyHistoryEntry[];
  // Status-only cross-author data drives stage chips and is always fetched.
  readonly crossAuthors: readonly CrossAuthorRow[];
  // Full foreign content is gated and remains undefined until requested.
  readonly foreignContent: readonly CrossAuthorContentRow[] | undefined;
  readonly isEveryone: boolean;
  readonly visibilityHydrated: boolean;
  readonly isForeignSlidesDeck: boolean;
  readonly isSubmitted: boolean;
  readonly selectedPeriodId: string | null;
  readonly showArchivePeriods: boolean;
}

export interface LeadFormLoadedViewModel {
  readonly products: Product[];
  readonly activityOptions: readonly { id: string; name: string }[];
  readonly ownCurrentWeekItems: readonly KanbanItem[];
  readonly ownNextWeekItems: readonly KanbanItem[];
  readonly ownRisks: readonly RiskEntry[];
  readonly ownDecisions: readonly DecisionEntry[];
  readonly activityCards: LeadActivityCard[];
  readonly currentWeekItems: readonly KanbanItem[];
  readonly nextWeekItems: readonly KanbanItem[];
  readonly risks: readonly RiskEntry[];
  readonly decisions: readonly DecisionEntry[];
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

// The author's own records, before co-owners' rows are merged in for display.
interface OwnDraftRecords {
  readonly ownCurrentWeekItems: readonly KanbanItem[];
  readonly ownNextWeekItems: readonly KanbanItem[];
  readonly ownRisks: readonly RiskEntry[];
  readonly ownDecisions: readonly DecisionEntry[];
}

// Foreign stage CHIPS show only in Everyone; Mine skips the override so
// co-owners' stages stay hidden. Product HEALTH stays honest in BOTH — it
// derives from the always-fetched status read inside SdlcPipeline.
function resolveDisplayProducts(
  data: MappedLeadForm,
  input: LeadFormLoadedInput,
): Product[] {
  return input.isEveryone
    ? applyCrossAuthorStageOverrides(
        data.products,
        buildCrossAuthorStageMap(input.crossAuthors),
      )
    : data.products;
}

const pickOwnDraftRecords = (data: MappedLeadForm): OwnDraftRecords => ({
  ownCurrentWeekItems: data.currentWeekItems,
  ownNextWeekItems: data.nextWeekItems,
  ownRisks: data.risks,
  ownDecisions: data.decisions,
});

// activity-first-class: the author's attached activities offered as record
// parents in the item/risk dialogs (id + display name only).
const toActivityOptions = (
  section: ReportSectionReadModel,
): readonly { id: string; name: string }[] =>
  section.activities.map((activity) => ({
    id: activity.activityId,
    name: activityDisplayTitle(activity),
  }));

// The interactive pill's floor is re-derived from the LIVE draft risks: the
// server-baked alarmFloor goes stale the moment a draft risk is added or
// removed (no refetch mid-edit). Read-only surfaces keep the server value.
const withLiveAlarmFloors = (
  cards: readonly LeadActivityCard[],
  ownRisks: readonly RiskEntry[],
): LeadActivityCard[] =>
  cards.map((card) => ({
    ...card,
    alarmFloor: deriveActivityAlarmFloor(card.activityId, ownRisks),
  }));

// Ranks already taken by own items across the period, so the edit dialog can
// disable them. Foreign rows are excluded — read-only rows cannot be edited.
const collectOwnPeriodRanks = (own: OwnDraftRecords): readonly number[] =>
  [...own.ownCurrentWeekItems, ...own.ownNextWeekItems]
    .map((item) => item.priorityRank)
    .filter((rank): rank is number => rank != null);

// A reopened section still carries published-lineage records, so the server's
// fillFrom guard rejects every source. Mirror the RAW check to disable the
// control rather than offer an always-failing action; the server still guards.
const isFillFromLocked = (
  lineage: LeadFormLoadedInput["publishedLineage"],
): boolean =>
  lineage.itemStableIds.length > 0 || lineage.decisionStableIds.length > 0;

interface LoadedModelParts {
  readonly input: LeadFormLoadedInput;
  readonly data: MappedLeadForm;
  readonly products: Product[];
  readonly own: OwnDraftRecords;
  readonly foreign: ForeignMergeResult;
}

function assembleLoadedViewModel({
  input,
  data,
  products,
  own,
  foreign,
}: LoadedModelParts): LeadFormLoadedViewModel {
  const { draftSection, publishedLineage } = input;
  const { hasArchivedPeriods, visiblePeriods } = filterVisiblePeriods(
    data.periods,
    input.selectedPeriodId,
    input.showArchivePeriods,
  );

  return {
    products,
    activityOptions: toActivityOptions(draftSection),
    ...own,
    activityCards: withLiveAlarmFloors(data.activityCards, own.ownRisks),
    ...foreign,
    ownPeriodRanks: collectOwnPeriodRanks(own),
    publishedLockedItemIds: publishedLockedIds(
      draftSection.items,
      publishedLineage.itemStableIds,
    ),
    publishedLockedDecisionIds: publishedLockedIds(
      draftSection.decisions,
      publishedLineage.decisionStableIds,
    ),
    fillFromLocked: isFillFromLocked(publishedLineage),
    unifiedEntries: buildUnifiedEntries(
      draftSection.items,
      foreign.currentWeekItems,
      foreign.nextWeekItems,
    ),
    currentUser: data.currentUser,
    canRequestReopen: data.canRequestReopen,
    hasArchivedPeriods,
    visiblePeriods,
    isReadOnly: data.readOnly || input.isSubmitted,
  };
}

// Pure projection of the loaded lead-form state into its display model.
// Cross-author gating, own-only write arrays, lineage locks, unified buckets
// and period visibility follow openspec/specs/lead-form-loaded-view-model.
export function buildLeadFormLoadedViewModel(
  input: LeadFormLoadedInput,
): LeadFormLoadedViewModel {
  // Map raw draft state -> Lead* presentation shapes for existing children.
  const data = mapLeadFormData({
    active: input.active,
    byPeriod: {
      section: input.draftSection,
      readOnly: input.serverReadOnly,
      canRequestReopen: input.canRequestReopen,
    },
    history: input.history,
  });

  const products = resolveDisplayProducts(data, input);
  const own = pickOwnDraftRecords(data);
  const foreign = mergeForeignDisplayRecords({
    products,
    ...own,
    foreignContent: input.foreignContent,
    isEveryone: input.isEveryone,
    visibilityHydrated: input.visibilityHydrated,
    isForeignSlidesDeck: input.isForeignSlidesDeck,
  });

  return assembleLoadedViewModel({ input, data, products, own, foreign });
}
