import type { RecordOmissionSummary } from "@weeklyreport/shared";

import { countLabel } from "./pluralize";

// The kinds left out, each with its count: "2 unfinished risks".
function omittedKinds(summary: RecordOmissionSummary): readonly string[] {
  return [
    ...(summary.risks > 0
      ? [countLabel(summary.risks, "unfinished risk", "unfinished risks")]
      : []),
    ...(summary.decisions > 0
      ? [
          countLabel(
            summary.decisions,
            "unfinished decision",
            "unfinished decisions",
          ),
        ]
      : []),
  ];
}

/**
 * What a reader is told about risks and decisions their authors have not
 * finished: such records stay with the author and never appear in the report
 * (openspec: viewer-report-navigation). Null when nothing is left out.
 *
 * A report frozen before counting is `unknown` in the data and silent here:
 * unfinished records could not be stored until counting shipped with them, so
 * such a report left nothing out and a warning on it would be false.
 */
export function recordOmissionNoticeText(
  summary: RecordOmissionSummary,
): string | null {
  const kinds = omittedKinds(summary);
  return kinds.length === 0
    ? null
    : `Not shown: ${kinds.join(" and ")}, still being written. This report may be incomplete.`;
}

/**
 * What publishing leaves behind, said before the Head confirms it. The total
 * covers every group, as the publication does; without one nothing is said.
 */
export function publishOmissionNote(
  summary: RecordOmissionSummary | undefined,
): string | undefined {
  if (summary === undefined) return undefined;
  const kinds = omittedKinds(summary);
  return kinds.length === 0
    ? undefined
    : `${kinds.join(" and ")} will be left out of the published report.`;
}

/**
 * What a search is told it cannot reach (openspec: search-contract-precision).
 * It describes the searched corpus and never says an omitted record matched.
 */
export function searchOmissionNote(
  summary: RecordOmissionSummary,
): string | null {
  const kinds = omittedKinds(summary);
  return kinds.length === 0
    ? null
    : `Search leaves out ${kinds.join(" and ")}, still being written.`;
}

/**
 * What the report assistant is told it cannot read. Like the search note it
 * describes the readable corpus and never says an omitted record matched.
 */
export function assistantOmissionNote(
  summary: RecordOmissionSummary,
): string | null {
  const kinds = omittedKinds(summary);
  return kinds.length === 0
    ? null
    : `The assistant does not read ${kinds.join(" and ")}, still being written.`;
}

/**
 * One period's line in the analytics disclosure (openspec:
 * analytics-query-correctness): what its figures leave out. Null when the
 * period leaves nothing out.
 */
export function periodOmissionNote(
  summary: RecordOmissionSummary,
): string | null {
  const kinds = omittedKinds(summary);
  return kinds.length === 0 ? null : kinds.join(" and ");
}
