"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import { useQueryErrorHandler } from "../../../../../shared/hooks/query/use-query-error-handler";
import type { SessionUser } from "../../../../../shared/lib/auth/session-provider";
import { getClientErrorDetails } from "../../../../../shared/lib/errors/client-error-reporting";
import { useTRPC } from "../../../../../shared/lib/trpc/trpc-context";
import { crossAuthorContentFetchEnabled } from "../../../../report-sections";
import type { RecordVisibility } from "../../../../report-sections/client";
import { useRecordVisibility } from "../../../../report-sections/client";
import {
  deriveActiveIds,
  deriveDeckVisibility,
  deriveTargetReportId,
} from "./use-lead-form-data-helpers";

// The error-relevant slice of a query result, so no whole-hook type crosses a seam.
interface QueryErrorSource {
  readonly isError: boolean;
  readonly error: unknown;
}

function isLeadFormUnavailableError(error: unknown): boolean {
  return getClientErrorDetails(error).trpcCode === "NOT_FOUND";
}

export interface LeadFormErrorSources {
  readonly activeQ: QueryErrorSource;
  readonly byPeriodQ: QueryErrorSource;
  readonly historyQ: QueryErrorSource;
  readonly viewSettingsQ: QueryErrorSource;
  readonly crossAuthorsQ: QueryErrorSource;
}

// Registered by the caller, after the navigation effects, so a failing load
// never toasts ahead of a pending redirect.
export function useLeadFormLoadErrors({
  activeQ,
  byPeriodQ,
  historyQ,
  viewSettingsQ,
  crossAuthorsQ,
  pinnedReportId,
  targetReportId,
  sessionRole,
}: LeadFormErrorSources & {
  readonly pinnedReportId: string | undefined;
  readonly targetReportId: string | null;
  readonly sessionRole: SessionUser["role"] | null;
}) {
  useQueryErrorHandler(activeQ, {
    event: "leadForm.activeReport.load_failed",
    component: "LeadForm",
    procedure: "reports.getActive",
    context: { reportId: pinnedReportId ?? null },
    toastPrefix: "Failed to load active report",
  });

  useQueryErrorHandler(byPeriodQ, {
    event: "leadForm.byPeriod.load_failed",
    component: "LeadForm",
    procedure: "leadForm.byPeriod",
    context: { reportId: targetReportId || null, role: sessionRole },
    toastPrefix: "Failed to load form",
  });

  useQueryErrorHandler(historyQ, {
    event: "leadForm.history.load_failed",
    component: "LeadForm",
    procedure: "reports.myHistory",
    toastPrefix: "Failed to load history",
  });

  useQueryErrorHandler(viewSettingsQ, {
    event: "leadForm.viewSettings.load_failed",
    component: "LeadForm",
    procedure: "leadForm.viewSettings",
    context: { reportId: targetReportId || null },
    toastPrefix: "Failed to load form settings",
  });

  useQueryErrorHandler(crossAuthorsQ, {
    event: "leadForm.crossAuthors.load_failed",
    component: "LeadForm",
    procedure: "leadForm.crossAuthors",
    context: { reportId: targetReportId || null },
    toastPrefix: "Failed to load cross-author data",
  });
}

function useLeadFormSectionRetry(refetchSection: () => Promise<unknown>) {
  const [byPeriodRetrying, setByPeriodRetrying] = useState(false);
  const retryPromiseRef = useRef<Promise<unknown> | null>(null);
  const retrySection = useCallback(() => {
    if (retryPromiseRef.current) return retryPromiseRef.current;
    setByPeriodRetrying(true);
    const retryPromise = refetchSection().finally(() => {
      retryPromiseRef.current = null;
      setByPeriodRetrying(false);
    });
    retryPromiseRef.current = retryPromise;
    return retryPromise;
  }, [refetchSection]);
  return { byPeriodRetrying, retrySection };
}

// Owns every report-scoped read. `view` is plain data so no react-query type
// reaches the lead-form UI seam; `errorSources` is the narrow failure slice.
export function useLeadFormReports({
  pinnedReportId,
  sectionFetchEnabled,
}: {
  readonly pinnedReportId: string | undefined;
  readonly sectionFetchEnabled: boolean;
}) {
  const trpc = useTRPC();
  const activeQ = useQuery(trpc.reports.getActive.queryOptions());
  const { activeReportId, activeSectionId } = deriveActiveIds(activeQ.data);
  const targetReportId = deriveTargetReportId(pinnedReportId, activeReportId);

  // With no resolvable report the query stays disabled; the reportId inside
  // the options is inert then (never sent), so it is only ever a cache key.
  const byPeriodQ = useQuery({
    ...trpc.leadForm.byPeriod.queryOptions({
      reportId: targetReportId ?? "",
    }),
    enabled: targetReportId !== null && sectionFetchEnabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  // A refetch of a query without data temporarily reports `isError: false`
  // while it is pending. Keep the terminal state visible through a user retry
  // so LeadForm never falls back to a skeleton or stale editable content.
  const refetchSection = byPeriodQ.refetch;
  const { byPeriodRetrying, retrySection } =
    useLeadFormSectionRetry(refetchSection);
  const historyQ = useQuery(trpc.reports.myHistory.queryOptions());
  const viewSettingsQ = useQuery(trpc.leadForm.viewSettings.queryOptions());
  const crossAuthorsQ = useQuery({
    ...trpc.leadForm.crossAuthors.queryOptions({
      reportId: targetReportId ?? "",
    }),
    enabled: targetReportId !== null,
  });
  const sectionUnavailable =
    byPeriodQ.isError && isLeadFormUnavailableError(byPeriodQ.error);

  return {
    errorSources: {
      activeQ,
      byPeriodQ: {
        isError: byPeriodQ.isError && !sectionUnavailable,
        error: byPeriodQ.error,
      },
      historyQ,
      viewSettingsQ,
      crossAuthorsQ,
    },
    view: {
      activeData: activeQ.data,
      activeReportId,
      targetReportId,
      // Pinned report: use loaded section id (active may not match); else active.
      sectionIdForActions:
        byPeriodQ.data?.section.reportSectionId ?? activeSectionId,
      byPeriodData: byPeriodQ.data,
      sectionUnavailable,
      // Keep the primary read's terminal state separate from `byPeriodData`:
      // TanStack Query can retain cached data after a failed refetch, but the
      // lead form must fail closed until a later read succeeds.
      byPeriodError:
        (byPeriodQ.isError && !sectionUnavailable) || byPeriodRetrying,
      byPeriodFetching: byPeriodQ.isFetching || byPeriodRetrying,
      refetchSection,
      retrySection,
      historyData: historyQ.data,
      unifiedView: viewSettingsQ.data?.unifiedActivityView === true,
      crossAuthors: crossAuthorsQ.data ?? [],
      isLoading: activeQ.isLoading || byPeriodQ.isLoading || historyQ.isLoading,
    },
  };
}

// Namespaced by user + report so Everyone cannot bleed across users/reports.
export function useDeckVisibility({
  currentUserId,
  targetReportId,
  isSlidesMode,
  slidesAuthorId,
}: {
  readonly currentUserId: string | null;
  readonly targetReportId: string | null;
  readonly isSlidesMode: boolean;
  readonly slidesAuthorId: string | null;
}): {
  recordVisibility: RecordVisibility;
  visibilityHydrated: boolean;
  setRecordVisibility: (next: RecordVisibility) => void;
  isEveryone: boolean;
  isForeignSlidesDeck: boolean;
  toolbarVisibility: RecordVisibility;
} {
  const {
    visibility: recordVisibility,
    hydrated: visibilityHydrated,
    setVisibility: setRecordVisibility,
  } = useRecordVisibility(currentUserId, targetReportId);

  return {
    recordVisibility,
    visibilityHydrated,
    setRecordVisibility,
    isEveryone: recordVisibility === "everyone",
    ...deriveDeckVisibility({
      isSlidesMode,
      slidesAuthorId,
      currentUserId,
      recordVisibility,
    }),
  };
}

// Full-content only after hydrated Everyone; foreign slides never fetch.
export function useCrossAuthorContent({
  targetReportId,
  visibilityHydrated,
  isEveryone,
  isForeignSlidesDeck,
}: {
  readonly targetReportId: string | null;
  readonly visibilityHydrated: boolean;
  readonly isEveryone: boolean;
  readonly isForeignSlidesDeck: boolean;
}) {
  const trpc = useTRPC();
  const enabled = crossAuthorContentFetchEnabled({
    hasReport: targetReportId !== null,
    visibilityHydrated,
    isEveryone,
    isOwnDeck: !isForeignSlidesDeck,
  });
  const query = useQuery({
    ...trpc.leadForm.crossAuthorContent.queryOptions({
      reportId: targetReportId ?? "",
    }),
    enabled,
  });
  // Foreign rows are auxiliary content, but a failed read must still surface
  // instead of silently reading as "no co-owner content".
  useQueryErrorHandler(query, {
    event: "leadForm.crossAuthorContent.load_failed",
    component: "LeadForm",
    procedure: "leadForm.crossAuthorContent",
    context: { reportId: targetReportId || null },
    toastPrefix: "Failed to load co-owner content",
  });
  return {
    data: query.data,
    isPending: enabled && query.isPending,
  };
}
