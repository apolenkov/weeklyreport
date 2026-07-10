"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface UseLeadFormRedirectsInput {
  readonly pinnedReportId: string | undefined;
  readonly redirectToCanonical: boolean | undefined;
  readonly isSlidesMode: boolean;
  readonly activeReportId: string;
  readonly shouldRouteHeadLikeAwayFromLeadForm: boolean;
}

/**
 * The lead form's route redirects, split from `useLeadFormData` only to keep
 * the data hook inside the complexity standard. Both effects move verbatim.
 */
export function useLeadFormRedirects({
  pinnedReportId,
  redirectToCanonical,
  isSlidesMode,
  activeReportId,
  shouldRouteHeadLikeAwayFromLeadForm,
}: UseLeadFormRedirectsInput): void {
  const router = useRouter();

  // 35-07: bare route → replace URL with the canonical addressed form once
  // the active reportId is known. Skipped when:
  //   • the page already renders under `[reportId]` (pinnedReportId set)
  //   • there is no active period (server returned null) — the form will
  //     show the existing empty / skeleton state.
  useEffect(() => {
    if (!redirectToCanonical) return;
    if (pinnedReportId) return;
    if (shouldRouteHeadLikeAwayFromLeadForm) return;
    if (!activeReportId) return;
    const next = new URLSearchParams();
    if (isSlidesMode) next.set("mode", "slides");
    const query = next.toString();
    const suffix = query ? `?${query}` : "";
    router.replace(`/lead/report/${activeReportId}${suffix}`);
  }, [
    redirectToCanonical,
    pinnedReportId,
    activeReportId,
    isSlidesMode,
    shouldRouteHeadLikeAwayFromLeadForm,
    router,
  ]);

  useEffect(() => {
    if (!shouldRouteHeadLikeAwayFromLeadForm) return;
    const destination = pinnedReportId
      ? `/head/report/${encodeURIComponent(pinnedReportId)}`
      : "/head/dashboard";
    router.replace(destination);
  }, [pinnedReportId, router, shouldRouteHeadLikeAwayFromLeadForm]);
}
