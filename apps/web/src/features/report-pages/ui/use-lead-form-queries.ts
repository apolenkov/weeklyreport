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
}

// Registered by the caller, after the navigation effects, so a failing load
// never toasts ahead of a pending redirect.
export function useLeadFormLoadErrors({
  activeQ,
  byPeriodQ,
  historyQ,
  pinnedReportId,
  targetReportId,
  sessionRole,
}: LeadFormErrorSources & {
  readonly pinnedReportId: string | undefined;
  readonly targetReportId: string;
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

  const byPeriodQ = useQuery({
    ...trpc.leadForm.byPeriod.queryOptions({ reportId: targetReportId }),
    enabled: targetReportId !== "" && sectionFetchEnabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const historyQ = useQuery(trpc.reports.myHistory.queryOptions());
  const viewSettingsQ = useQuery(trpc.leadForm.viewSettings.queryOptions());
  const crossAuthorsQ = useQuery({
    ...trpc.leadForm.crossAuthors.queryOptions({ reportId: targetReportId }),
    enabled: targetReportId !== "",
  });

  return {
    errorSources: { activeQ, byPeriodQ, historyQ },
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
  readonly targetReportId: string;
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
  readonly targetReportId: string;
  readonly visibilityHydrated: boolean;
  readonly isEveryone: boolean;
  readonly isForeignSlidesDeck: boolean;
}) {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.leadForm.crossAuthorContent.queryOptions({
      reportId: targetReportId,
    }),
    enabled: crossAuthorContentFetchEnabled({
      hasReport: targetReportId !== "",
      visibilityHydrated,
      isEveryone,
      isOwnDeck: !isForeignSlidesDeck,
    }),
  });
  return query.data;
}
