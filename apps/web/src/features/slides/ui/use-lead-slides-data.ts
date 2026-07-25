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
import type { LeadSlideFormData } from "./lead-slide-form-data";

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

// Which period the deck shows: the requested one when it is still in the
// lead's history, else the active report.
function useTargetReportId({
  history,
  activeReportId,
  requestedReportId,
}: {
  readonly history:
    Parameters<typeof buildLeadSlidePeriodOptions>[0] | undefined;
  readonly activeReportId: string | null;
  readonly requestedReportId: string | null;
}): string {
  const periodOptions = useMemo(
    () => buildLeadSlidePeriodOptions(history ?? [], activeReportId),
    [history, activeReportId],
  );
  return useMemo(
    () =>
      resolveLeadSlideReportId({
        options: periodOptions,
        requestedReportId,
        activeReportId,
      }),
    [periodOptions, requestedReportId, activeReportId],
  );
}

// Cross-author content is a privileged read: drop it from the cache the moment
// the "everyone" toggle is off (or unhydrated), and whenever the viewer changes.
function useCrossAuthorContentEviction({
  isEveryone,
  visibilityHydrated,
  targetReportId,
  currentUserId,
}: {
  readonly isEveryone: boolean;
  readonly visibilityHydrated: boolean;
  readonly targetReportId: string;
  readonly currentUserId: string | null;
}): void {
  const qc = useQueryClient();
  const trpc = useTRPC();

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
}

interface LeadDeckSourceData {
  readonly byPeriodData:
    { section?: ReportSectionReadModel | null } | undefined;
  readonly crossAuthors: Parameters<typeof buildLeadDeckModel>[1] | undefined;
  readonly crossAuthorContent:
    Parameters<typeof buildLeadDeckModel>[2] | undefined;
  readonly isOwnDeck: boolean;
  readonly isEveryone: boolean;
  readonly visibilityHydrated: boolean;
}

// The slide read models the deck renders. Foreign rows only ever reach the
// model while "everyone" is on AND hydrated.
function useLeadDeckSlides({
  byPeriodData,
  crossAuthors,
  crossAuthorContent,
  isOwnDeck,
  isEveryone,
  visibilityHydrated,
}: LeadDeckSourceData) {
  const foreignContentRows = useMemo(
    () => (isEveryone && visibilityHydrated ? (crossAuthorContent ?? []) : []),
    [isEveryone, visibilityHydrated, crossAuthorContent],
  );
  const sectionModel = useMemo(() => {
    if (!byPeriodData?.section) return null;
    return buildLeadDeckModel(
      byPeriodData.section,
      isOwnDeck ? (crossAuthors ?? []) : [],
      foreignContentRows,
    );
  }, [byPeriodData, crossAuthors, foreignContentRows, isOwnDeck]);
  return useMemo(() => (sectionModel ? [sectionModel] : []), [sectionModel]);
}

/**
 * Use Lead Slides Data.
 * @param props - The props argument.
 */
export function useLeadSlidesData({
  initialReportId,
  visibilityMode,
  visibilityHydrated,
}: UseLeadSlidesDataArgs): LeadSlidesData {
  const trpc = useTRPC();
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
  const targetReportId = useTargetReportId({
    history: historyQ.data,
    activeReportId,
    requestedReportId,
  });

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

  useCrossAuthorContentEviction({
    isEveryone,
    visibilityHydrated,
    targetReportId,
    currentUserId,
  });

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

  const slides = useLeadDeckSlides({
    byPeriodData: byPeriodQ.data,
    crossAuthors: crossAuthorsQ.data,
    crossAuthorContent: crossAuthorContentQ.data,
    isOwnDeck,
    isEveryone,
    visibilityHydrated,
  });
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
    section: byPeriodQ.data?.section ?? null,
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
