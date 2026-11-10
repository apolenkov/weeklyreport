import type { RecordOmissionSummary } from "@weeklyreport/shared";

import { countLabel } from "../../../shared/lib/format/pluralize";

const UNCOUNTED =
  "Part of this report was published before unfinished records were counted, so some may be missing here.";

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
 * (openspec: viewer-report-navigation). Null when nothing is left out. An
 * uncounted section is said to be unknown, never passed off as zero.
 */
export function recordOmissionNoticeText(
  summary: RecordOmissionSummary,
): string | null {
  const kinds = omittedKinds(summary);
  if (kinds.length === 0) return summary.unknown ? UNCOUNTED : null;
  const counted = `Not shown: ${summary.unknown ? "at least " : ""}${kinds.join(" and ")}. Authors are still working on them, so this report may be incomplete.`;
  return summary.unknown ? `${counted} ${UNCOUNTED}` : counted;
}

/** What publishing leaves behind, said before the Head confirms it. */
export function publishOmissionNote(
  summary: RecordOmissionSummary,
): string | undefined {
  const kinds = omittedKinds(summary);
  return kinds.length === 0
    ? undefined
    : `${kinds.join(" and ")} will be left out of the published report.`;
}
