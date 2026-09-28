"use client";

import { DEFAULT_ORGANIZATION_IDENTITY } from "@customreport/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useContext, useEffect, useMemo } from "react";

import { SessionContext } from "../../../../shared/lib/auth/session-provider";
import {
  formatPeriodRangeWithYear,
  isoWeekNumber,
} from "../../../../shared/lib/format/format-date";
import { getScalarSearchParam } from "../../../../shared/lib/navigation/scalar-search-param";

interface CanonicalRedirectArgs {
  readonly enabled: boolean | undefined;
  readonly reportId: string | undefined;
  readonly resolvedReportId: string | null;
  readonly focusedAuthorId: string | null;
  readonly canonicalBasePath: string;
}

// The unpinned entry route resolves to the active report URL once known.
export function useCanonicalReportRedirect({
  enabled,
  reportId,
  resolvedReportId,
  focusedAuthorId,
  canonicalBasePath,
}: CanonicalRedirectArgs): void {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!enabled) return;
    if (reportId) return;
    if (!resolvedReportId) return;
    const next = new URLSearchParams();
    if (focusedAuthorId) next.set("authorId", focusedAuthorId);
    for (const key of [
      "mode",
      "scope",
      "archive",
      "feedback",
      "feedbackUrl",
      "agentationSession",
      "agentationAnnotation",
    ] as const) {
      const value = getScalarSearchParam(searchParams, key);
      if (value) next.set(key, value);
    }
    const query = next.toString();
    const querySuffix = query ? `?${query}` : "";
    router.replace(`${canonicalBasePath}/${resolvedReportId}${querySuffix}`, {
      scroll: false,
    });
  }, [
    enabled,
    reportId,
    resolvedReportId,
    focusedAuthorId,
    router,
    canonicalBasePath,
    searchParams,
  ]);
}

interface ReportPeriodBounds {
  readonly periodStart: unknown;
  readonly periodEnd: unknown;
}

// Period bounds arrive untyped-at-runtime from the transport, so the title is
// only written once both ends really are Dates; unmount restores the previous.
export function useReportDocumentTitle(
  period: ReportPeriodBounds | undefined,
): void {
  const titleParts = useMemo(() => {
    const start = period?.periodStart;
    const end = period?.periodEnd;
    if (!(start instanceof Date) || !(end instanceof Date)) return null;
    return {
      week: isoWeekNumber(start),
      range: formatPeriodRangeWithYear(start, end),
    };
  }, [period]);
  // Mirrors the root metadata template (`%s · ${orgName}`); absent organization
  // resolves to the canonical tenant-neutral placeholder, never a product brand.
  const titleBrand =
    useContext(SessionContext)?.organization?.fullName ??
    DEFAULT_ORGANIZATION_IDENTITY.fullName;

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!titleParts) return;
    const previous = document.title;
    document.title = `Week ${titleParts.week}, ${titleParts.range} · ${titleBrand}`;
    return () => {
      document.title = previous;
    };
  }, [titleParts, titleBrand]);
}
