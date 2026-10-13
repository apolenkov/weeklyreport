"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

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
  router: ReturnType<typeof useRouter>,
) {
  const pendingNavigationRef = useRef<PendingNavigation | null>(null);
  useEffect(() => {
    const pending = pendingNavigationRef.current;
    if (!pending) return;
    if (
      pathname !== pending.pathname ||
      (observedQuery !== pending.observedQuery &&
        observedQuery !== pending.inFlightQuery)
    ) {
      pendingNavigationRef.current = null;
    } else if (observedQuery === pending.inFlightQuery) {
      if (observedQuery === pending.desiredQuery) {
        pendingNavigationRef.current = null;
      } else {
        // Advance before navigating so repeated effects cannot replay an acknowledgement.
        pendingNavigationRef.current = {
          ...pending,
          observedQuery,
          inFlightQuery: pending.desiredQuery,
        };
        const suffix = pending.desiredQuery ? `?${pending.desiredQuery}` : "";
        router.replace(`${pathname}${suffix}`, { scroll: false });
      }
    }
  }, [pathname, observedQuery, router]);

  useEffect(() => {
    // Back may land on the in-flight URL; it must still supersede queued selections.
    const cancelPending = () => {
      pendingNavigationRef.current = null;
    };
    window.addEventListener("popstate", cancelPending);
    return () => window.removeEventListener("popstate", cancelPending);
  }, []);
  return pendingNavigationRef;
}

// Shared head/viewer report-shell URL state. stripParams is wiped on every
// setter call — viewer passes ["source","recovery"] so a later NOT_FOUND is
// not misread as Status navigation bouncing back to the Status target.
export function useReportShellUrlState({
  stripParams,
}: {
  readonly stripParams: readonly string[];
}): ReportShellUrlState {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const observedQuery = searchParams.toString();
  const pendingNavigationRef = usePendingNavigation(
    pathname,
    observedQuery,
    router,
  );

  const buildQuery = useCallback(
    (overrides: Record<string, string | null>) => {
      const qs = buildReportQuery(searchParams, stripParams, overrides);
      return qs ? `?${qs}` : "";
    },
    [searchParams, stripParams],
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
        pendingNavigationRef.current = { ...pending, desiredQuery };
        return;
      }

      const desiredQuery = buildReportQuery(
        searchParams,
        stripParams,
        overrides,
      );
      pendingNavigationRef.current =
        desiredQuery === observedQuery
          ? null
          : {
              pathname,
              observedQuery,
              inFlightQuery: desiredQuery,
              desiredQuery,
            };
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
    ],
  );

  const includeArchive = getScalarSearchParam(searchParams, "archive") === "1";
  const setIncludeArchive = useCallback(
    (value: boolean) => updateQuery({ archive: value ? "1" : null }),
    [updateQuery],
  );

  const scope: ReportShellScopeValue =
    getScalarSearchParam(searchParams, "scope") === "lead" ? "lead" : "product";
  const setScope = useCallback(
    (value: ReportShellScopeValue) =>
      updateQuery({ scope: value === "lead" ? "lead" : null }),
    [updateQuery],
  );

  return { buildQuery, includeArchive, setIncludeArchive, scope, setScope };
}
