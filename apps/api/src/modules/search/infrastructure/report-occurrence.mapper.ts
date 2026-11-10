import {
  type parsePublishedSnapshot,
  toRecordOmission,
} from "@weeklyreport/report-persistence";

import { mapPrismaToReportSection } from "../../report-sections/index.js";
import type { SelectableReportSource } from "../domain/period-source-selection.js";
import type { ReportOccurrence } from "../domain/report-retrieval.types.js";

type LiveSectionRow = Parameters<typeof mapPrismaToReportSection>[0];
type PublishedSnapshot = NonNullable<ReturnType<typeof parsePublishedSnapshot>>;

function toOccurrence(
  source: SelectableReportSource,
  sections: ReportOccurrence["sections"],
  recordOmissions: NonNullable<ReportOccurrence["recordOmissions"]>,
): ReportOccurrence {
  return {
    reportId: source.reportId,
    periodId: source.periodId,
    periodLabel: source.periodLabel,
    periodStart: source.periodStart,
    source: source.source,
    sections,
    recordOmissions,
  };
}

/** A live section's unfinished records are counted from its current rows. */
export function liveOccurrence(
  source: SelectableReportSource,
  rows: readonly LiveSectionRow[],
): ReportOccurrence {
  return toOccurrence(
    source,
    rows.map(mapPrismaToReportSection),
    new Map(rows.map((row) => [row.id, toRecordOmission(row)])),
  );
}

/**
 * A published section keeps the counts frozen with it. A section frozen before
 * the counts existed has no entry, which readers report as unknown.
 */
export function snapshotOccurrence(
  source: SelectableReportSource,
  snapshot: PublishedSnapshot,
): ReportOccurrence {
  return toOccurrence(
    source,
    snapshot.sections,
    new Map(
      snapshot.sections.flatMap((section) =>
        section.recordOmission
          ? [[section.reportSectionId, section.recordOmission] as const]
          : [],
      ),
    ),
  );
}
