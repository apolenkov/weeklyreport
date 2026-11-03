"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { copyReportSearchParams } from "../../lib/navigation/report-search-params";
import { getScalarSearchParam } from "../../lib/navigation/scalar-search-param";

export type ReportShellScopeValue = "product" | "lead";

export interface ReportShellUrlState {
  // null/"" deletes a key. stripParams members are always deleted first so
  // one-shot markers never survive an in-shell navigation.
  readonly buildQuery: (overrides: Record<string, string | null>) => string;
  readonly includeArchive: boolean;
  readonly setIncludeArchive: (value: boolean) => void;
  readonly scope: ReportShellScopeValue;
  readonly setScope: (value: ReportShellScopeValue) => void;
  readonly reviewIntent: boolean;
  readonly setReviewIntent: (value: boolean) => void;
  readonly navigateAuthor: (authorId: string) => void;
}

interface PendingNavigation {
  readonly pathname: string;
  readonly observedQuery: string;
  readonly inFlightQuery: string;
  readonly desiredQuery: string;
}

function buildReportQuery(
  searchParams: Pick<URLSearchParams, "toString">,
  stripParams: readonly string[],
  overrides: Record<string, string | null>,
): string {
  const next = copyReportSearchParams(searchParams);
  for (const key of stripParams) next.delete(key);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
  }
  return next.toString();
}

function usePendingNavigation(
  pathname: string,
  observedQuery: string,
  router: AppRouterInstance,
) {
  const pendingNavigationRef = useRef<PendingNavigation | null>(null);
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNavigation | null>(null);
  const publishPending = useCallback((pending: PendingNavigation | null) => {
    pendingNavigationRef.current = pending;
    setPendingNavigation(pending);
  }, []);
  useEffect(() => {
    const pending = pendingNavigationRef.current;
    if (!pending) return;
    if (
      pathname !== pending.pathname ||
      (observedQuery !== pending.observedQuery &&
        observedQuery !== pending.inFlightQuery)
    ) {
      publishPending(null);
    } else if (observedQuery === pending.inFlightQuery) {
      if (observedQuery === pending.desiredQuery) {
        publishPending(null);
      } else {
        // Advance before navigating so repeated effects cannot replay an acknowledgement.
        publishPending({
          ...pending,
          observedQuery,
          inFlightQuery: pending.desiredQuery,
        });
        const suffix = pending.desiredQuery ? `?${pending.desiredQuery}` : "";
        router.replace(`${pathname}${suffix}`, { scroll: false });
      }
    }
  }, [pathname, observedQuery, router, publishPending]);

  useEffect(() => {
    // Back may land on the in-flight URL; it must still supersede queued selections.
    const cancelPending = () => {
      publishPending(null);
    };
    window.addEventListener("popstate", cancelPending);
    return () => window.removeEventListener("popstate", cancelPending);
  }, [publishPending]);
  const controlQuery =
    pendingNavigation?.pathname === pathname &&
    (observedQuery === pendingNavigation.observedQuery ||
      observedQuery === pendingNavigation.inFlightQuery)
      ? pendingNavigation.desiredQuery
      : observedQuery;
  return {
    pendingNavigationRef,
    publishPending,
    controlParams: new URLSearchParams(controlQuery),
  };
}

function useReportQueryNavigation(stripParams: readonly string[]) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const observedQuery = searchParams.toString();
  const { pendingNavigationRef, publishPending, controlParams } =
    usePendingNavigation(pathname, observedQuery, router);

  const buildQuery = useCallback(
    (overrides: Record<string, string | null>) => {
      const qs = buildReportQuery(controlParams, stripParams, overrides);
      return qs ? `?${qs}` : "";
    },
    [controlParams, stripParams],
  );

  const updateQuery = useCallback(
    (overrides: Record<string, string | null>) => {
      const pending = pendingNavigationRef.current;
      if (
        pending?.pathname === pathname &&
        (observedQuery === pending.observedQuery ||
          observedQuery === pending.inFlightQuery)
      ) {
        const desiredQuery = buildReportQuery(
          new URLSearchParams(pending.desiredQuery),
          stripParams,
          overrides,
        );
        publishPending({ ...pending, desiredQuery });
        return;
      }

      const desiredQuery = buildReportQuery(
        searchParams,
        stripParams,
        overrides,
      );
      publishPending(
        desiredQuery === observedQuery
          ? null
          : {
              pathname,
              observedQuery,
              inFlightQuery: desiredQuery,
              desiredQuery,
            },
      );
      if (desiredQuery !== observedQuery) {
        const suffix = desiredQuery ? `?${desiredQuery}` : "";
        router.replace(`${pathname}${suffix}`, { scroll: false });
      }
    },
    [
      pathname,
      observedQuery,
      searchParams,
      stripParams,
      router,
      pendingNavigationRef,
      publishPending,
    ],
  );

  return { buildQuery, updateQuery, controlParams };
}

// One pending URL owner keeps overlapping controls and destination links aligned.
export function useReportShellUrlState({
  stripParams,
}: {
  readonly stripParams: readonly string[];
}): ReportShellUrlState {
  const { buildQuery, updateQuery, controlParams } =
    useReportQueryNavigation(stripParams);
  const includeArchive = getScalarSearchParam(controlParams, "archive") === "1";
  const setIncludeArchive = useCallback(
    (value: boolean) => updateQuery({ archive: value ? "1" : null }),
    [updateQuery],
  );

  const scope: ReportShellScopeValue =
    getScalarSearchParam(controlParams, "scope") === "lead"
      ? "lead"
      : "product";
  const setScope = useCallback(
    (value: ReportShellScopeValue) =>
      updateQuery({ scope: value === "lead" ? "lead" : null }),
    [updateQuery],
  );

  const reviewIntent = getScalarSearchParam(controlParams, "review") === "1";
  const setReviewIntent = useCallback(
    (value: boolean) => updateQuery({ review: value ? "1" : null }),
    [updateQuery],
  );
  const navigateAuthor = useCallback(
    (authorId: string) => updateQuery({ scope: "lead", authorId }),
    [updateQuery],
  );
  return {
    buildQuery,
    includeArchive,
    setIncludeArchive,
    scope,
    setScope,
    reviewIntent,
    setReviewIntent,
    navigateAuthor,
  };
}
