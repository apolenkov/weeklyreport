"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useContext } from "react";

import { useRecordVisibility } from "../../../hooks/use-record-visibility";
import { crossAuthorContentFetchEnabled } from "../../../lib/cross-author-content-gate";
import { isHeadLike } from "../../../lib/role-predicates";
import { SessionContext } from "../../../lib/session-provider";
import { useTRPC } from "../../../lib/trpc-context";
import { useQueryErrorHandler } from "../../../lib/use-query-error-handler";
import {
  deriveActiveIds,
  deriveDeckVisibility,
  deriveSessionActors,
  deriveTargetReportId,
} from "./use-lead-form-data-helpers";
import { useLeadFormForeignContentPurge } from "./use-lead-form-foreign-content-purge";
import { useLeadFormRedirects } from "./use-lead-form-redirects";

interface UseLeadFormDataInput {
  // Path-segment reportId scopes load away from the session's active period.
  readonly reportId?: string;
  // Bare-route → canonical addressed URL once active reportId is known.
  readonly redirectToCanonical?: boolean;
  readonly isSlidesMode: boolean;
}

// Feature-local reads/gating only — not a cross-role ReportDataCoordinator.
/**
 * Use Lead Form Data.
 * @param props - The props argument.
 */
export function useLeadFormData({
  reportId: pinnedReportId,
  redirectToCanonical,
  isSlidesMode,
}: UseLeadFormDataInput) {
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  const sessionState = useContext(SessionContext);
  const { sessionRole, currentUserId, shouldDeferForSession } =
    deriveSessionActors(sessionState);
  const isHeadLikeSession = isHeadLike(sessionRole);
  const shouldRouteHeadLikeAwayFromLeadForm = isHeadLikeSession;

  const activeQ = useQuery(trpc.reports.getActive.queryOptions());
  const { activeReportId, activeSectionId } = deriveActiveIds(activeQ.data);

  const targetReportId = deriveTargetReportId(pinnedReportId, activeReportId);

  const byPeriodQ = useQuery({
    ...trpc.leadForm.byPeriod.queryOptions({
      reportId: targetReportId,
    }),
    enabled:
      targetReportId !== "" &&
      !shouldRouteHeadLikeAwayFromLeadForm &&
      !shouldDeferForSession,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // Pinned report: use loaded section id (active may not match); else active.
  const sectionIdForActions =
    byPeriodQ.data?.section.reportSectionId ?? activeSectionId;

  const historyQ = useQuery(trpc.reports.myHistory.queryOptions());

  const viewSettingsQ = useQuery(trpc.leadForm.viewSettings.queryOptions());
  const unifiedView = viewSettingsQ.data?.unifiedActivityView === true;

  const crossAuthorsQ = useQuery({
    ...trpc.leadForm.crossAuthors.queryOptions({
      reportId: targetReportId,
    }),
    enabled: targetReportId !== "",
  });

  // Namespaced by user + report so Everyone cannot bleed across users/reports.
  const {
    visibility: recordVisibility,
    hydrated: visibilityHydrated,
    setVisibility: setRecordVisibility,
  } = useRecordVisibility(currentUserId, targetReportId);
  const isEveryone = recordVisibility === "everyone";

  const { isForeignSlidesDeck, toolbarVisibility } = deriveDeckVisibility({
    isSlidesMode,
    slidesAuthorId: searchParams.get("authorId"),
    currentUserId,
    recordVisibility,
  });

  // Full-content only after hydrated Everyone; foreign slides never fetch.
  const crossAuthorContentQ = useQuery({
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

  useLeadFormForeignContentPurge({
    isEveryone,
    visibilityHydrated,
    targetReportId,
    currentUserId,
    sessionRole,
  });

  useLeadFormRedirects({
    pinnedReportId,
    redirectToCanonical,
    isSlidesMode,
    activeReportId,
    shouldRouteHeadLikeAwayFromLeadForm,
  });

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

  const isLoading =
    activeQ.isLoading || byPeriodQ.isLoading || historyQ.isLoading;
  const awaitingRoleRedirect = shouldRouteHeadLikeAwayFromLeadForm;
  const awaitingCanonicalRedirect =
    !!redirectToCanonical && !pinnedReportId && activeReportId !== "";

  return {
    activeData: activeQ.data,
    activeReportId,
    targetReportId,
    sectionIdForActions,
    byPeriodData: byPeriodQ.data,
    refetchSection: byPeriodQ.refetch,
    historyData: historyQ.data,
    unifiedView,
    crossAuthors: crossAuthorsQ.data ?? [],
    foreignContent: crossAuthorContentQ.data,
    recordVisibility,
    visibilityHydrated,
    setRecordVisibility,
    isEveryone,
    isForeignSlidesDeck,
    toolbarVisibility,
    isLoading,
    awaitingRoleRedirect,
    awaitingCanonicalRedirect,
  };
}
