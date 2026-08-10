"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import { useMemo } from "react";

import {
  type CrossAuthorContentRow,
  mapLeadFormData,
} from "../../report-sections";
import { type SectionSlideModel } from "../model/section-slide-contracts";
import type { LeadSlideFormData } from "./lead-slide-form-data";
import {
  useLeadDeckPeriod,
  useLeadDeckRequest,
  useLeadDeckSlides,
  useLeadSlideSectionQueries,
} from "./use-lead-slides-data-helpers";

interface UseLeadSlidesDataArgs {
  readonly initialReportId: string | null;
  readonly foreignContent: readonly CrossAuthorContentRow[] | undefined;
  readonly foreignContentPending: boolean;
  readonly visibilityMode: "mine" | "everyone";
  readonly visibilityHydrated: boolean;
}

interface LeadSlidesData {
  readonly inReportMode: boolean;
  readonly targetReportId: string;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly slides: readonly SectionSlideModel[];
  readonly section: ReportSectionReadModel | null;
  readonly formData: LeadSlideFormData | null;
  readonly canInlineEdit: boolean;
  readonly refetchSection: () => Promise<unknown>;
}

function canEditInlineRecord({
  targetReportId,
  isOwnDeck,
  formData,
}: {
  readonly targetReportId: string;
  readonly isOwnDeck: boolean;
  readonly formData: LeadSlideFormData | null;
}): boolean {
  return (
    targetReportId !== "" &&
    isOwnDeck &&
    formData !== null &&
    !formData.readOnly
  );
}

function useLeadSlideFormData(
  byPeriod: Parameters<typeof mapLeadFormData>[0]["byPeriod"] | undefined,
  history: Parameters<typeof mapLeadFormData>[0]["history"] | undefined,
): LeadSlideFormData | null {
  return useMemo(() => {
    if (!byPeriod?.section) return null;
    return mapLeadFormData({
      active: byPeriod.section,
      byPeriod,
      history: history ?? [],
    });
  }, [byPeriod, history]);
}

export function useLeadSlidesData({
  initialReportId,
  foreignContent,
  foreignContentPending,
  visibilityMode,
  visibilityHydrated,
}: UseLeadSlidesDataArgs): LeadSlidesData {
  const request = useLeadDeckRequest(initialReportId, visibilityMode);
  const period = useLeadDeckPeriod(request.requestedReportId);
  const { targetReportId } = period;

  const queries = useLeadSlideSectionQueries(request, targetReportId);

  const slides = useLeadDeckSlides({
    byPeriodData: queries.byPeriodQ.data,
    crossAuthors: queries.crossAuthorsQ.data,
    foreignContent,
    isOwnDeck: request.isOwnDeck,
    isEveryone: request.isEveryone,
    visibilityHydrated,
  });
  const formData = useLeadSlideFormData(queries.byPeriodQ.data, period.history);

  return {
    inReportMode: request.inReportMode,
    targetReportId,
    isLoading:
      period.isLoading || queries.byPeriodQ.isLoading || foreignContentPending,
    isError: period.isError || queries.byPeriodQ.isError,
    slides,
    section: queries.byPeriodQ.data?.section ?? null,
    formData,
    canInlineEdit: canEditInlineRecord({
      targetReportId,
      isOwnDeck: request.isOwnDeck,
      formData,
    }),
    refetchSection: () => queries.byPeriodQ.refetch(),
  };
}
