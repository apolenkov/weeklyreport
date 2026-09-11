import { getScalarSearchParam } from "../../../../../shared/lib/navigation/scalar-search-param";

export function buildStatusOverviewDetailsHref(
  reportId: string,
  searchParams: Pick<URLSearchParams, "getAll">,
): string {
  const next = new URLSearchParams({ mode: "edit" });
  for (const key of [
    "feedback",
    "feedbackUrl",
    "agentationSession",
    "agentationAnnotation",
  ] as const) {
    const value = getScalarSearchParam(searchParams, key);
    if (value) next.set(key, value);
  }
  return `/lead/report/${encodeURIComponent(reportId)}?${next.toString()}#report-details`;
}
