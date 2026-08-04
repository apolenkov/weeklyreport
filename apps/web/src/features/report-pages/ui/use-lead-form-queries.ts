"use client";

import { useQuery } from "@tanstack/react-query";

import type { RecordVisibility } from "../../../hooks/use-record-visibility";
import { useRecordVisibility } from "../../../hooks/use-record-visibility";
import { crossAuthorContentFetchEnabled } from "../../../lib/cross-author-content-gate";
import type { SessionUser } from "../../../lib/session-provider";
import { useTRPC } from "../../../lib/trpc-context";
import { useQueryErrorHandler } from "../../../lib/use-query-error-handler";
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
  const historyQ = useQuery(trpc.reports.myHistory.queryOptions());
  const viewSettingsQ = useQuery(trpc.leadForm.viewSettings.queryOptions());
  const crossAuthorsQ = useQuery({
    ...trpc.leadForm.crossAuthors.queryOptions({
      reportId: targetReportId ?? "",
    }),
    enabled: targetReportId !== null,
  });

  return {
    errorSources: {
      activeQ,
      byPeriodQ,
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
      refetchSection: byPeriodQ.refetch,
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
  const query = useQuery({
    ...trpc.leadForm.crossAuthorContent.queryOptions({
      reportId: targetReportId ?? "",
    }),
    enabled: crossAuthorContentFetchEnabled({
      hasReport: targetReportId !== null,
      visibilityHydrated,
      isEveryone,
      isOwnDeck: !isForeignSlidesDeck,
    }),
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
  return query.data;
}
