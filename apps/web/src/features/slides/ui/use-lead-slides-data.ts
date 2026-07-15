"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { useContext, useEffect, useMemo } from "react";

import { crossAuthorContentFetchEnabled } from "../../../lib/cross-author-content-gate";
import { SessionContext } from "../../../lib/session-provider";
import { useTRPC } from "../../../lib/trpc-context";
import { useQueryErrorHandler } from "../../../lib/use-query-error-handler";
import { mapLeadFormData } from "../../report-sections";
import {
  buildLeadSlidePeriodOptions,
  resolveLeadSlideReportId,
} from "../model/lead-slide-periods";
import { buildLeadDeckModel } from "../model/lead-slides-deck-model";
import { type SectionSlideModel } from "../model/section-slide-contracts";
import { paginateSectionSlides } from "../model/section-slide-pagination";

export type LeadSlideFormData = NonNullable<ReturnType<typeof mapLeadFormData>>;

interface UseLeadSlidesDataArgs {
  readonly initialReportId: string | null;
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
  readonly refetchSection: () => void;
}

function isOwnLeadDeck(
  authorId: string | undefined,
  currentUserId: string | null,
): boolean {
  if (authorId === undefined) return true;
  return currentUserId !== null && authorId === currentUserId;
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

export function useLeadSlidesData({
  initialReportId,
  visibilityMode,
  visibilityHydrated,
}: UseLeadSlidesDataArgs): LeadSlidesData {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const session = useContext(SessionContext);

  const activeQ = useQuery(trpc.reports.getActive.queryOptions());
  const historyQ = useQuery(trpc.reports.myHistory.queryOptions());
  const activeReportId = activeQ.data?.reportId ?? null;
  const inReportMode = pathname.startsWith("/lead/report/");
  const requestedReportId = inReportMode
    ? initialReportId
    : searchParams.get("reportId");
  const authorId = searchParams.get("authorId") ?? undefined;
  const currentUserId = session?.user?.id ?? null;
  const isOwnDeck = isOwnLeadDeck(authorId, currentUserId);
  const isEveryone = isOwnDeck && visibilityMode === "everyone";
  const periodOptions = useMemo(
    () => buildLeadSlidePeriodOptions(historyQ.data ?? [], activeReportId),
    [historyQ.data, activeReportId],
  );
  const targetReportId = useMemo(
    () =>
      resolveLeadSlideReportId({
        options: periodOptions,
        requestedReportId,
        activeReportId,
      }),
    [periodOptions, requestedReportId, activeReportId],
  );
  const byPeriodQ = useQuery({
    ...trpc.leadForm.byPeriod.queryOptions({
      reportId: targetReportId,
      authorId,
    }),
    enabled: targetReportId !== "",
  });
  const crossAuthorsQ = useQuery({
    ...trpc.leadForm.crossAuthors.queryOptions({
      reportId: targetReportId,
    }),
    enabled: targetReportId !== "" && isOwnDeck,
  });
  const crossAuthorContentQ = useQuery({
    ...trpc.leadForm.crossAuthorContent.queryOptions({
      reportId: targetReportId,
    }),
    enabled: crossAuthorContentFetchEnabled({
      hasReport: targetReportId !== "",
      visibilityHydrated,
      isEveryone,
      isOwnDeck,
    }),
  });

  useEffect(() => {
    if (isEveryone && visibilityHydrated) return;
    qc.removeQueries({
      queryKey: trpc.leadForm.crossAuthorContent.queryKey(),
    });
  }, [isEveryone, visibilityHydrated, targetReportId, qc, trpc]);

  useEffect(() => {
    qc.removeQueries({
      queryKey: trpc.leadForm.crossAuthorContent.queryKey(),
    });
  }, [currentUserId, qc, trpc]);

  useQueryErrorHandler(activeQ, {
    event: "leadSlides.getActive.load_failed",
    component: "LeadSlidesClient",
    procedure: "reports.getActive",
  });
  useQueryErrorHandler(byPeriodQ, {
    event: "leadSlides.byPeriod.load_failed",
    component: "LeadSlidesClient",
    procedure: "leadForm.byPeriod",
    context: { reportId: targetReportId || null },
  });

  const foreignContentRows = useMemo(
    () =>
      isEveryone && visibilityHydrated ? (crossAuthorContentQ.data ?? []) : [],
    [isEveryone, visibilityHydrated, crossAuthorContentQ.data],
  );
  const sectionModel = useMemo(() => {
    if (!byPeriodQ.data?.section) return null;
    return buildLeadDeckModel(
      byPeriodQ.data.section,
      isOwnDeck ? (crossAuthorsQ.data ?? []) : [],
      foreignContentRows,
    );
  }, [byPeriodQ.data, crossAuthorsQ.data, foreignContentRows, isOwnDeck]);
  const slides = useMemo(
    () => (sectionModel ? paginateSectionSlides(sectionModel) : []),
    [sectionModel],
  );
  const section = byPeriodQ.data?.section ?? null;
  const formData = useMemo<LeadSlideFormData | null>(() => {
    if (!byPeriodQ.data?.section) return null;
    return mapLeadFormData({
      active: byPeriodQ.data.section,
      byPeriod: byPeriodQ.data,
      history: historyQ.data ?? [],
    });
  }, [byPeriodQ.data, historyQ.data]);

  return {
    inReportMode,
    targetReportId,
    isLoading: activeQ.isLoading || byPeriodQ.isLoading || historyQ.isLoading,
    isError: activeQ.isError || byPeriodQ.isError || historyQ.isError,
    slides,
    section,
    formData,
    canInlineEdit: canEditInlineRecord({
      targetReportId,
      isOwnDeck,
      formData,
    }),
    refetchSection: () => {
      void byPeriodQ.refetch();
    },
  };
}
