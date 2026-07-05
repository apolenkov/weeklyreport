"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import type { ScopeValue } from "./scope-toggle";

interface ReportShellUrlState {
  /**
   * Build a query string from the current params with `overrides` applied
   * (a `null`/`""` value deletes the key). Members of `stripParams` are always
   * deleted first, so one-shot markers never survive an in-shell navigation.
   */
  readonly buildQuery: (overrides: Record<string, string | null>) => string;
  readonly includeArchive: boolean;
  readonly setIncludeArchive: (value: boolean) => void;
  readonly scope: ScopeValue;
  readonly setScope: (value: ScopeValue) => void;
}

/**
 * Shared head/viewer report-shell URL state (web-shared-idioms): the
 * search-params reader, the `URLSearchParams`-based setter, and the
 * archive/scope derivations both shells previously duplicated.
 *
 * `stripParams` members are deleted on EVERY setter call. The head passes `[]`;
 * the viewer passes `["source", "recovery"]` — its load-bearing one-shot-marker
 * strip that keeps a later NOT_FOUND from being misread as a Status navigation
 * and bouncing the viewer back to the Status target. The viewer concern is
 * realised through this list, never by re-forking the setter.
 */
export function useReportShellUrlState({
  stripParams,
}: {
  readonly stripParams: readonly string[];
}): ReportShellUrlState {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const buildQuery = useCallback(
    (overrides: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const key of stripParams) next.delete(key);
      for (const [key, value] of Object.entries(overrides)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      return qs ? `?${qs}` : "";
    },
    [searchParams, stripParams],
  );

  const includeArchive = searchParams.get("archive") === "1";
  const setIncludeArchive = useCallback(
    (value: boolean) => {
      router.replace(
        `${pathname}${buildQuery({ archive: value ? "1" : null })}`,
        {
          scroll: false,
        },
      );
    },
    [router, pathname, buildQuery],
  );

  const scope: ScopeValue =
    searchParams.get("scope") === "lead" ? "lead" : "product";
  const setScope = useCallback(
    (value: ScopeValue) => {
      router.replace(
        `${pathname}${buildQuery({ scope: value === "lead" ? "lead" : null })}`,
        { scroll: false },
      );
    },
    [router, pathname, buildQuery],
  );

  return { buildQuery, includeArchive, setIncludeArchive, scope, setScope };
}
