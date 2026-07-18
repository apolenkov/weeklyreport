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
  /**
   * 35-07: explicit report identifier from the dynamic `[reportId]` route
   * segment. When provided, the data load is scoped to that specific report
   * instead of the session's active period.
   */
  readonly reportId?: string;
  /**
   * 35-07: when true, the bare route is replaced (router.replace) with the
   * canonical addressed URL once the active reportId is known. Off when
   * already on a `[reportId]` route.
   */
  readonly redirectToCanonical?: boolean;
  readonly isSlidesMode: boolean;
}

/**
 * The lead form's data-loading boundary: the six lead-form queries with their
 * enablement chains, record-visibility gating, the foreign-content purge
 * guard, canonical/head-away redirects, and query error handlers. Returns the
 * flat value set `LeadForm` previously derived inline.
 *
 * This hook is feature-local at the exact granularity of the sibling
 * `use-lead-form-*` hooks: it owns only THIS form's reads and gating. It is
 * NOT the deferred `ReportDataCoordinator` (reusable/cross-role) and must not
 * absorb the draft/write/merge boundaries or be imported by head/viewer
 * surfaces (see `architecture-refactor-backlog`).
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

  // Three queries compose the lead-form view. `byPeriod` depends on
  // identifiers from `getActive` (or — 35-07 — the pinned `reportId` from
  // the dynamic route), so it's gated by `enabled`.
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

  // The section id for actions (autosave / submit / revoke) comes from the
  // loaded section when a reportId is pinned (the active session's section
  // id may not match the pinned report). Fall back to activeSectionId for
  // the bare-route case until byPeriod resolves.
  const sectionIdForActions =
    byPeriodQ.data?.section.reportSectionId ?? activeSectionId;

  const historyQ = useQuery(trpc.reports.myHistory.queryOptions());

  // Org-level presentation flag for the opt-in unified by-state view (ADR
  // 0011). Classic two-section format is the default until the flag loads —
  // and stays the default when it is off.
  const viewSettingsQ = useQuery(trpc.leadForm.viewSettings.queryOptions());
  const unifiedView = viewSettingsQ.data?.unifiedActivityView === true;

  // F1: load other authors who share a product with the current user.
  // Only relevant when viewing your own section (not a foreign-author view).
  const crossAuthorsQ = useQuery({
    ...trpc.leadForm.crossAuthors.queryOptions({
      reportId: targetReportId,
    }),
    enabled: targetReportId !== "",
  });

  // scope-lead-report-to-own-contribution (7c): Record visibility toggle. The
  // key is namespaced by the signed-in user AND the loaded report so an
  // "everyone" choice cannot bleed across users (shared browser / dev
  // role-switcher) or across reports (D4c). The toggle is lead-form-only.
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

  // 7c.3: the full-content read is fetched ONLY in the Everyone state, and only
  // AFTER the persisted toggle has hydrated — so it never fires on the
  // pre-hydration "mine" default and then races a restored "everyone".
  // close-slides-visibility-tails (tail 1): gate via the shared predicate, with
  // own-deck = !isForeignSlidesDeck, so a foreign slides deck NEVER fires the
  // read regardless of the persisted Everyone toggle (matches LeadSlidesClient).
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

  // Query error policy — log + toast via unified hook (design.md D1/D2).
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
