"use client";

import type { ReportSectionReadModel } from "@customreport/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { useContext, useEffect, useMemo } from "react";

import { crossAuthorContentFetchEnabled } from "../../../lib/cross-author-content-gate";
import { SessionContext } from "../../../lib/session-provider";
import { useTRPC } from "../../../lib/trpc-context";
import { useQueryErrorHandler } from "../../../lib/use-query-error-handler";
import {
  buildLeadSlidePeriodOptions,
  resolveLeadSlideReportId,
} from "../model/lead-slide-periods";
import { buildLeadDeckModel } from "../model/lead-slides-deck-model";

function isOwnLeadDeck(
  authorId: string | undefined,
  currentUserId: string | null,
): boolean {
  if (authorId === undefined) return true;
  return currentUserId !== null && authorId === currentUserId;
}

export interface LeadDeckRequest {
  readonly inReportMode: boolean;
  readonly requestedReportId: string | null;
  readonly authorId: string | undefined;
  readonly currentUserId: string | null;
  readonly isOwnDeck: boolean;
  readonly isEveryone: boolean;
}

// Route, query string and session together decide whose deck is on screen and
// whether cross-author rows may be shown at all.
export function useLeadDeckRequest(
  initialReportId: string | null,
  visibilityMode: "mine" | "everyone",
): LeadDeckRequest {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const session = useContext(SessionContext);

  const inReportMode = pathname.startsWith("/lead/report/");
  const authorId = searchParams.get("authorId") ?? undefined;
  const currentUserId = session?.user?.id ?? null;
  const isOwnDeck = isOwnLeadDeck(authorId, currentUserId);

  return {
    inReportMode,
    requestedReportId: inReportMode
      ? initialReportId
      : searchParams.get("reportId"),
    authorId,
    currentUserId,
    isOwnDeck,
    isEveryone: isOwnDeck && visibilityMode === "everyone",
  };
}

// Which period the deck shows: the requested one when it is still in the
// lead's history, else the active report.
export function useLeadDeckPeriod(requestedReportId: string | null) {
  const trpc = useTRPC();
  const activeQ = useQuery(trpc.reports.getActive.queryOptions());
  const historyQ = useQuery(trpc.reports.myHistory.queryOptions());
  useQueryErrorHandler(activeQ, {
    event: "leadSlides.getActive.load_failed",
    component: "LeadSlidesClient",
    procedure: "reports.getActive",
  });

  const activeReportId = activeQ.data?.reportId ?? null;
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

  return {
    history: historyQ.data,
    targetReportId,
    isLoading: activeQ.isLoading || historyQ.isLoading,
    isError: activeQ.isError || historyQ.isError,
  };
}

// The three section reads for the target report. Cross-author reads are
// privileged, so each carries its own enablement gate.
export function useLeadSlideSectionQueries(
  { authorId, isOwnDeck, isEveryone }: LeadDeckRequest,
  targetReportId: string,
  visibilityHydrated: boolean,
) {
  const trpc = useTRPC();

  const byPeriodQ = useQuery({
    ...trpc.leadForm.byPeriod.queryOptions({
      reportId: targetReportId,
      authorId,
    }),
    enabled: targetReportId !== "",
  });
  const crossAuthorsQ = useQuery({
    ...trpc.leadForm.crossAuthors.queryOptions({ reportId: targetReportId }),
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

  useQueryErrorHandler(byPeriodQ, {
    event: "leadSlides.byPeriod.load_failed",
    component: "LeadSlidesClient",
    procedure: "leadForm.byPeriod",
    context: { reportId: targetReportId || null },
  });

  return { byPeriodQ, crossAuthorsQ, crossAuthorContentQ };
}

// Cross-author content is a privileged read: drop it from the cache the moment
// the "everyone" toggle is off (or unhydrated), and whenever the viewer changes.
export function useCrossAuthorContentEviction({
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
export function useLeadDeckSlides({
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
