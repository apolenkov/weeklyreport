"use client";

import { useSearchParams } from "next/navigation";
import { useContext } from "react";

import { isHeadLike } from "../../../lib/role-predicates";
import type { SessionUser } from "../../../lib/session-provider";
import { SessionContext } from "../../../lib/session-provider";
import { deriveSessionActors } from "./use-lead-form-data-helpers";
import { useLeadFormForeignContentPurge } from "./use-lead-form-foreign-content-purge";
import type { LeadFormErrorSources } from "./use-lead-form-queries";
import {
  useCrossAuthorContent,
  useDeckVisibility,
  useLeadFormLoadErrors,
  useLeadFormReports,
} from "./use-lead-form-queries";
import { useLeadFormRedirects } from "./use-lead-form-redirects";

interface UseLeadFormDataInput {
  // Path-segment reportId scopes load away from the session's active period.
  readonly reportId?: string | undefined;
  // Bare-route → canonical addressed URL once active reportId is known.
  readonly redirectToCanonical?: boolean | undefined;
  readonly isSlidesMode: boolean;
}

// The input restated with the pinned id under its resolved name.
interface LeadFormRoute {
  readonly pinnedReportId: string | undefined;
  readonly redirectToCanonical: boolean | undefined;
  readonly isSlidesMode: boolean;
}

// Effects that contribute nothing to the returned view. Registration order is
// load-bearing: purge, then redirects, then load-failure reporting.
function useLeadFormEffects({
  route,
  activeReportId,
  targetReportId,
  currentUserId,
  sessionRole,
  isEveryone,
  visibilityHydrated,
  shouldRouteHeadLikeAwayFromLeadForm,
  errorSources,
}: {
  readonly route: LeadFormRoute;
  readonly activeReportId: string;
  readonly targetReportId: string;
  readonly currentUserId: string | null;
  readonly sessionRole: SessionUser["role"] | null;
  readonly isEveryone: boolean;
  readonly visibilityHydrated: boolean;
  readonly shouldRouteHeadLikeAwayFromLeadForm: boolean;
  readonly errorSources: LeadFormErrorSources;
}) {
  useLeadFormForeignContentPurge({
    isEveryone,
    visibilityHydrated,
    targetReportId,
    currentUserId,
    sessionRole,
  });

  useLeadFormRedirects({
    pinnedReportId: route.pinnedReportId,
    redirectToCanonical: route.redirectToCanonical,
    isSlidesMode: route.isSlidesMode,
    activeReportId,
    shouldRouteHeadLikeAwayFromLeadForm,
  });

  useLeadFormLoadErrors({
    ...errorSources,
    pinnedReportId: route.pinnedReportId,
    targetReportId,
    sessionRole,
  });
}

// Feature-local reads/gating only — not a cross-role ReportDataCoordinator.
export function useLeadFormData({
  reportId: pinnedReportId,
  redirectToCanonical,
  isSlidesMode,
}: UseLeadFormDataInput) {
  const route = { pinnedReportId, redirectToCanonical, isSlidesMode };
  const searchParams = useSearchParams();
  const sessionState = useContext(SessionContext);
  const { sessionRole, currentUserId, shouldDeferForSession } =
    deriveSessionActors(sessionState);
  const shouldRouteHeadLikeAwayFromLeadForm = isHeadLike(sessionRole);

  const { errorSources, view } = useLeadFormReports({
    pinnedReportId,
    sectionFetchEnabled:
      !shouldRouteHeadLikeAwayFromLeadForm && !shouldDeferForSession,
  });

  const visibility = useDeckVisibility({
    currentUserId,
    targetReportId: view.targetReportId,
    isSlidesMode,
    slidesAuthorId: searchParams.get("authorId"),
  });

  const foreignContent = useCrossAuthorContent({
    targetReportId: view.targetReportId,
    visibilityHydrated: visibility.visibilityHydrated,
    isEveryone: visibility.isEveryone,
    isForeignSlidesDeck: visibility.isForeignSlidesDeck,
  });

  useLeadFormEffects({
    route,
    activeReportId: view.activeReportId,
    targetReportId: view.targetReportId,
    currentUserId,
    sessionRole,
    isEveryone: visibility.isEveryone,
    visibilityHydrated: visibility.visibilityHydrated,
    shouldRouteHeadLikeAwayFromLeadForm,
    errorSources,
  });

  return {
    ...view,
    ...visibility,
    foreignContent,
    awaitingRoleRedirect: shouldRouteHeadLikeAwayFromLeadForm,
    awaitingCanonicalRedirect:
      !!redirectToCanonical && !pinnedReportId && view.activeReportId !== "",
  };
}
