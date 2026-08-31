"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface UseLeadFormRedirectsInput {
  readonly pinnedReportId: string | undefined;
  readonly redirectToCanonical: boolean | undefined;
  readonly isSlidesMode: boolean;
  readonly activeReportId: string | null;
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

  // Resolve the unpinned entry route once the active reportId is known; skip
  // if already pinned or no active period is available yet.
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
