"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

interface UseLeadFormRedirectsInput {
  readonly pinnedReportId: string | undefined;
  readonly redirectToCanonical: boolean | undefined;
  readonly isSlidesMode: boolean;
  readonly canonicalMode?: "overview" | "edit" | "slides" | undefined;
  readonly activeReportId: string | null;
  readonly shouldRouteHeadLikeAwayFromLeadForm: boolean;
}

export function useLeadFormRedirects({
  pinnedReportId,
  redirectToCanonical,
  isSlidesMode,
  canonicalMode,
  activeReportId,
  shouldRouteHeadLikeAwayFromLeadForm,
}: UseLeadFormRedirectsInput): void {
  const router = useRouter();
  const searchParams = useSearchParams();

  const feedbackQuery = useCallback(() => {
    const next = new URLSearchParams();
    for (const key of [
      "feedback",
      "feedbackUrl",
      "agentationSession",
      "agentationAnnotation",
    ] as const) {
      const value = searchParams.get(key);
      if (value) next.set(key, value);
    }
    return next;
  }, [searchParams]);

  // Resolve the unpinned entry route once the active reportId is known; skip
  // if already pinned or no active period is available yet.
  useEffect(() => {
    if (!redirectToCanonical) return;
    if (pinnedReportId) return;
    if (shouldRouteHeadLikeAwayFromLeadForm) return;
    if (!activeReportId) return;
    const next = feedbackQuery();
    if (canonicalMode) next.set("mode", canonicalMode);
    else if (isSlidesMode) next.set("mode", "slides");
    const query = next.toString();
    const suffix = query ? `?${query}` : "";
    router.replace(`/lead/report/${activeReportId}${suffix}`);
  }, [
    redirectToCanonical,
    pinnedReportId,
    activeReportId,
    isSlidesMode,
    canonicalMode,
    shouldRouteHeadLikeAwayFromLeadForm,
    router,
    feedbackQuery,
  ]);

  useEffect(() => {
    if (!shouldRouteHeadLikeAwayFromLeadForm) return;
    const next = feedbackQuery();
    const authorId = searchParams.get("authorId");
    if (authorId) next.set("authorId", authorId);
    const query = next.toString();
    const querySuffix = query ? `?${query}` : "";
    const destination = pinnedReportId
      ? `/head/report/${encodeURIComponent(pinnedReportId)}${querySuffix}`
      : query
        ? `/head/report?${query}`
        : "/head/dashboard";
    router.replace(destination);
  }, [
    feedbackQuery,
    pinnedReportId,
    router,
    searchParams,
    shouldRouteHeadLikeAwayFromLeadForm,
  ]);
}
