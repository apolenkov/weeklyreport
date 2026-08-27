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
  TRetry,
> {
  readonly activeData: TActive;
  readonly activeReportId: string | null;
  readonly activeSectionId: string | null;
  readonly targetReportId: string | null;
  readonly byPeriodData: TByPeriod;
  readonly sectionUnavailable: boolean;
  readonly byPeriodIsError: boolean;
  readonly byPeriodIsFetching: boolean;
  readonly byPeriodRetrying: boolean;
  readonly refetchSection: TRefetch;
  readonly retrySection: TRetry;
  readonly historyData: THistory;
  readonly settingsData: TSettings;
  readonly crossAuthors: TCrossAuthors;
  readonly loadingStates: readonly boolean[];
}

export function buildLeadFormReportsView<
  TActive,
  TByPeriod extends ReportSectionCarrier | undefined,
  THistory,
  TSettings extends { readonly unifiedActivityView?: boolean } | undefined,
  TCrossAuthors extends readonly unknown[] | undefined,
  TRefetch,
  TRetry,
>(
  input: LeadFormReportsViewInput<
    TActive,
    TByPeriod,
    THistory,
    TSettings,
    TCrossAuthors,
    TRefetch,
    TRetry
  >,
) {
  return {
    activeData: input.activeData,
    activeReportId: input.activeReportId,
    targetReportId: input.targetReportId,
    sectionIdForActions:
      input.byPeriodData?.section.reportSectionId ?? input.activeSectionId,
    byPeriodData: input.byPeriodData,
    sectionUnavailable: input.sectionUnavailable,
    byPeriodError:
      (input.byPeriodIsError && !input.sectionUnavailable) ||
      input.byPeriodRetrying,
    byPeriodFetching: input.byPeriodIsFetching || input.byPeriodRetrying,
    refetchSection: input.refetchSection,
    retrySection: input.retrySection,
    historyData: input.historyData,
    unifiedView: input.settingsData?.unifiedActivityView === true,
    crossAuthors: input.crossAuthors ?? [],
    isLoading: input.loadingStates.some(Boolean),
  };
}
