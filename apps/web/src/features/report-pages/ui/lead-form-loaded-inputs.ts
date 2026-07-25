import type {
  MyHistoryEntry,
  ReportSectionReadModel,
} from "@customreport/shared";

import type {
  CrossAuthorContentRow,
  CrossAuthorRow,
} from "../../report-sections";
import type { LeadFormLoadedData } from "./lead-form-loaded";
import type { PublishedLineage } from "./lead-form-loaded-record-builders";
import type { LeadFormLoadedInput } from "./lead-form-loaded-view-model";
import type { LeadFormLoadedContext } from "./lead-form-submit-context";

interface LeadFormByPeriodLoaded {
  readonly section: ReportSectionReadModel;
  readonly readOnly: boolean;
  readonly canRequestReopen: boolean;
  readonly publishedLineage: PublishedLineage;
}

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
  readonly selectedPeriodId: string;
  readonly showArchivePeriods: boolean;
}

// Null until every query settles and the draft mirror exists; LeadForm renders
// its skeleton on null, and the non-null bundle carries the narrowed rows.
/**
 * Resolve Lead Form Loaded.
 * @param data - The data argument.
 * @param draftSection - The draftSection argument.
 */
export function resolveLeadFormLoaded(
  data: LeadFormLoadingState,
  draftSection: ReportSectionReadModel | null,
): LeadFormLoadedBundle | null {
  if (
    data.isLoading ||
    data.awaitingRoleRedirect ||
    data.awaitingCanonicalRedirect ||
    data.activeData === undefined ||
    !data.byPeriodData ||
    !data.historyData ||
    !draftSection
  ) {
    return null;
  }
  return {
    active: data.activeData ?? draftSection,
    draftSection,
    byPeriodData: data.byPeriodData,
    historyData: data.historyData,
  };
}

/**
 * Lead Form View Model Input.
 * @param data - The data argument.
 * @param loaded - The loaded argument.
 * @param presentation - The presentation argument.
 */
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
/**
 * Build Lead Form Loaded Data.
 * @param data - The data argument.
 */
export function buildLeadFormLoadedData(
  data: LeadFormLoadedData,
): LeadFormLoadedData {
  return {
    byPeriodData: data.byPeriodData,
    toolbarVisibility: data.toolbarVisibility,
    setRecordVisibility: data.setRecordVisibility,
    isForeignSlidesDeck: data.isForeignSlidesDeck,
    targetReportId: data.targetReportId,
    activeReportId: data.activeReportId,
    visibilityHydrated: data.visibilityHydrated,
    unifiedView: data.unifiedView,
    recordVisibility: data.recordVisibility,
    crossAuthors: data.crossAuthors,
  };
}

// Only VALUES flow into the draft module — no ref protocol crosses the file
// boundary, so the module owns its own refresh ordering.
/**
 * Loaded Context Of.
 * @param viewModel - The viewModel argument.
 */
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
