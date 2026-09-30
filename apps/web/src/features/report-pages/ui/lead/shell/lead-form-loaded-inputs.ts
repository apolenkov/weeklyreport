import type {
  MyHistoryEntry,
  PublishedLineage,
  ReportSectionReadModel,
} from "@customreport/shared";

import type {
  CrossAuthorContentRow,
  CrossAuthorRow,
  LeadFormLoadedContext,
  LeadFormLoadedInput,
} from "../../../../report-sections";
import { leadFormGenerationOf } from "../../../../report-sections";
import type { LeadFormLoadedData } from "./lead-form-loaded";

interface LeadFormByPeriodLoaded {
  readonly section: ReportSectionReadModel;
  readonly readOnly: boolean;
  readonly canRequestReopen: boolean;
  // Why the lead cannot request a reopen; the API owns the reason vocabulary.
  readonly reopenBlockedReason?: string | null | undefined;
  readonly publishedLineage: PublishedLineage;
}

const PENDING_REOPEN_REASON = "pending_request_exists";

export interface LeadFormLoadingState {
  readonly isLoading: boolean;
  readonly awaitingRoleRedirect: boolean;
  readonly awaitingCanonicalRedirect: boolean;
  readonly activeData: ReportSectionReadModel | null | undefined;
  readonly byPeriodData: LeadFormByPeriodLoaded | undefined;
  readonly historyData: readonly MyHistoryEntry[] | undefined;
}

export interface LeadFormLoadedBundle {
  readonly active: ReportSectionReadModel;
  readonly draftSection: ReportSectionReadModel;
  readonly byPeriodData: LeadFormByPeriodLoaded;
  readonly historyData: readonly MyHistoryEntry[];
}

export interface LeadFormViewModelData {
  readonly crossAuthors: readonly CrossAuthorRow[];
  readonly foreignContent: readonly CrossAuthorContentRow[] | undefined;
  readonly isEveryone: boolean;
  readonly visibilityHydrated: boolean;
  readonly isForeignSlidesDeck: boolean;
}

export interface LeadFormPresentationState {
  readonly isSubmitted: boolean;
  readonly selectedPeriodId: string | null;
  readonly showArchivePeriods: boolean;
}

// Called after required reads are ready; the mirrored draft must still match
// the server generation before it can enter the loaded editor.
export function resolveLeadFormLoaded(
  data: LeadFormLoadingState,
  draftSection: ReportSectionReadModel | null,
): LeadFormLoadedBundle | null {
  if (
    data.isLoading ||
    data.awaitingRoleRedirect ||
    data.awaitingCanonicalRedirect ||
    data.activeData === undefined ||
    data.activeData === null ||
    !data.byPeriodData ||
    !data.historyData ||
    !draftSection ||
    leadFormGenerationOf(data.byPeriodData.section) !==
      leadFormGenerationOf(draftSection)
  ) {
    return null;
  }
  return {
    active: data.activeData,
    draftSection,
    byPeriodData: data.byPeriodData,
    historyData: data.historyData,
  };
}

export function leadFormViewModelInput(
  data: LeadFormViewModelData,
  loaded: LeadFormLoadedBundle,
  presentation: LeadFormPresentationState,
): LeadFormLoadedInput {
  return {
    active: loaded.active,
    draftSection: loaded.draftSection,
    serverReadOnly: loaded.byPeriodData.readOnly,
    canRequestReopen: loaded.byPeriodData.canRequestReopen,
    hasPendingReopen:
      loaded.byPeriodData.reopenBlockedReason === PENDING_REOPEN_REASON,
    publishedLineage: loaded.byPeriodData.publishedLineage,
    history: loaded.historyData,
    crossAuthors: data.crossAuthors,
    foreignContent: data.foreignContent,
    isEveryone: data.isEveryone,
    visibilityHydrated: data.visibilityHydrated,
    isForeignSlidesDeck: data.isForeignSlidesDeck,
    isSubmitted: presentation.isSubmitted,
    selectedPeriodId: presentation.selectedPeriodId,
    showArchivePeriods: presentation.showArchivePeriods,
  };
}

// The declared slice LeadFormLoaded and its children read — narrower than the
// shell data, which also carries LeadForm's own draft/chrome inputs.
export function buildLeadFormLoadedData(
  data: Omit<LeadFormLoadedData, "onRecordVisibilityChange"> & {
    readonly setRecordVisibility: LeadFormLoadedData["onRecordVisibilityChange"];
  },
): LeadFormLoadedData {
  return {
    byPeriodData: data.byPeriodData,
    toolbarVisibility: data.toolbarVisibility,
    onRecordVisibilityChange: data.setRecordVisibility,
    isForeignSlidesDeck: data.isForeignSlidesDeck,
    targetReportId: data.targetReportId,
    activeReportId: data.activeReportId,
    visibilityHydrated: data.visibilityHydrated,
    unifiedView: data.unifiedView,
    recordVisibility: data.recordVisibility,
    crossAuthors: data.crossAuthors,
    foreignContent: data.foreignContent,
    foreignContentPending: data.foreignContentPending,
  };
}

// Only VALUES flow into the draft module — no ref protocol crosses the file
// boundary, so the module owns its own refresh ordering.
export function loadedContextOf(viewModel: {
  readonly products: LeadFormLoadedContext["products"];
  readonly currentWeekItems: LeadFormLoadedContext["currentWeekItems"];
  readonly nextWeekItems: LeadFormLoadedContext["nextWeekItems"];
}): LeadFormLoadedContext {
  return {
    products: viewModel.products,
    currentWeekItems: viewModel.currentWeekItems,
    nextWeekItems: viewModel.nextWeekItems,
  };
}
