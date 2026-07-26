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

export function useLeadFormRedirects({
  pinnedReportId,
  redirectToCanonical,
  isSlidesMode,
  activeReportId,
  shouldRouteHeadLikeAwayFromLeadForm,
}: UseLeadFormRedirectsInput): void {
  const router = useRouter();

  // Bare route → canonical once active reportId is known; skip if already
  // pinned or no active period (empty/skeleton).
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
