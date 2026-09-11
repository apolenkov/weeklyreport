import type { LeadFormRequiredReadState } from "../use-lead-form-required-reads";

interface ReportSectionCarrier {
  readonly section: { readonly reportSectionId: string };
}

interface LeadFormReportsViewInput<
  TActive,
  TByPeriod extends ReportSectionCarrier | undefined,
  THistory,
  TSettings extends { readonly unifiedActivityView?: boolean } | undefined,
  TCrossAuthors extends readonly unknown[] | undefined,
  TRefetch,
> {
  readonly activeData: TActive;
  readonly activeReportId: string | null;
  readonly activeSectionId: string | null;
  readonly targetReportId: string | null;
  readonly byPeriodData: TByPeriod;
  readonly readState: LeadFormRequiredReadState;
  readonly refetchSection: TRefetch;
  readonly historyData: THistory;
  readonly settingsData: TSettings;
  readonly crossAuthors: TCrossAuthors;
}

export function buildLeadFormReportsView<
  TActive,
  TByPeriod extends ReportSectionCarrier | undefined,
  THistory,
  TSettings extends { readonly unifiedActivityView?: boolean } | undefined,
  TCrossAuthors extends readonly unknown[] | undefined,
  TRefetch,
>(
  input: LeadFormReportsViewInput<
    TActive,
    TByPeriod,
    THistory,
    TSettings,
    TCrossAuthors,
    TRefetch
  >,
) {
  return {
    activeData: input.activeData,
    activeReportId: input.activeReportId,
    targetReportId: input.targetReportId,
    sectionIdForActions:
      input.byPeriodData?.section.reportSectionId ?? input.activeSectionId,
    byPeriodData: input.byPeriodData,
    readState: input.readState,
    refetchSection: input.refetchSection,
    historyData: input.historyData,
    unifiedView: input.settingsData?.unifiedActivityView === true,
    crossAuthors: input.crossAuthors ?? [],
    isLoading: input.readState.status === "loading",
  };
}
