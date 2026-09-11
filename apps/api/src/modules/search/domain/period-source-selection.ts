import type { SearchPlan } from "@customreport/shared";

import { normalizeEntityReference } from "./entity-alias-index.js";

export type SelectableReportSource = Readonly<{
  reportId: string;
  periodId: string;
  periodLabel: string;
  periodStart: Date;
  periodStatus: "open" | "published" | "reopened";
  source: "live" | "snapshot";
}>;

type PeriodIntent = Pick<SearchPlan, "periods">;

const newestFirst = (a: SelectableReportSource, b: SelectableReportSource) =>
  b.periodStart.getTime() - a.periodStart.getTime() ||
  b.reportId.localeCompare(a.reportId);

const uniqueReports = (
  sources: readonly SelectableReportSource[],
): readonly SelectableReportSource[] =>
  sources.filter(
    (source, index) =>
      sources.findIndex(
        (candidate) => candidate.reportId === source.reportId,
      ) === index,
  );

/** Select exactly one canonical source per report before section authorization. */
export function selectPeriodSources(
  sources: readonly SelectableReportSource[],
  intent: PeriodIntent,
  now: Date,
): readonly SelectableReportSource[] {
  const current = intent.periods.includeCurrent
    ? sources
        .filter(
          (source) =>
            source.source === "live" &&
            source.periodStart <= now &&
            (source.periodStatus === "open" ||
              source.periodStatus === "reopened"),
        )
        .sort(newestFirst)
        .slice(0, 1)
    : [];
  const published = sources
    .filter(
      (source) =>
        source.source === "snapshot" && source.periodStatus === "published",
    )
    .sort(newestFirst);
  const requested =
    intent.periods.published.mode === "latest"
      ? published.slice(0, intent.periods.published.count ?? 0)
      : intent.periods.published.mode === "all"
        ? published
        : intent.periods.published.mode === "named"
          ? published.filter((source) =>
              intent.periods.published.references.some(
                (reference) =>
                  normalizeEntityReference(reference) ===
                  normalizeEntityReference(source.periodLabel),
              ),
            )
          : [];

  return uniqueReports([...current, ...requested]);
}
