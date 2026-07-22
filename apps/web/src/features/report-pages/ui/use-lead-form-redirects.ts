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
 * Keeps the lead form on its canonical report route and sends head-like roles
 * to their read-only surface.
 */
export function useLeadFormRedirects({
  pinnedReportId,
  redirectToCanonical,
  isSlidesMode,
  activeReportId,
  shouldRouteHeadLikeAwayFromLeadForm,
}: UseLeadFormRedirectsInput): void {
  const router = useRouter();

  // Replace a bare route with the canonical addressed form once the active
  // reportId is known. Skip when:
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
