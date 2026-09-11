"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

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

  const buildQuery = useCallback(
    (overrides: Record<string, string | null>) => {
      const next = copyReportSearchParams(searchParams);
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

  const includeArchive = getScalarSearchParam(searchParams, "archive") === "1";
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

  const scope: ReportShellScopeValue =
    getScalarSearchParam(searchParams, "scope") === "lead" ? "lead" : "product";
  const setScope = useCallback(
    (value: ReportShellScopeValue) => {
      router.replace(
        `${pathname}${buildQuery({ scope: value === "lead" ? "lead" : null })}`,
        { scroll: false },
      );
    },
    [router, pathname, buildQuery],
  );

  return { buildQuery, includeArchive, setIncludeArchive, scope, setScope };
}
