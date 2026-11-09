import { isCompleteDecision, isCompleteRisk } from "@weeklyreport/shared";

import type { PrismaReportSectionWithRelations as SectionRow } from "../report-sections.include.js";

type CompleteRisk = SectionRow["risks"][number] & {
  readonly impact: string;
  readonly mitigation: string;
};
type CompleteDecision = SectionRow["decisions"][number] & {
  readonly impact: string;
};

/** A section row whose risks and decisions all carry their details. */
export type CompleteSectionRow = Omit<SectionRow, "risks" | "decisions"> & {
  readonly risks: CompleteRisk[];
  readonly decisions: CompleteDecision[];
};

/**
 * Drops the author-private incomplete risks and decisions from a section row.
 * Every reader other than the author starts from this row, so status floors,
 * referenced Products and aggregates never see an incomplete record. Items and
 * all other relations pass through unchanged; the input row is not mutated.
 */
export const toCompleteSectionRow = (row: SectionRow): CompleteSectionRow => ({
  ...row,
  risks: row.risks.filter(isCompleteRisk),
  decisions: row.decisions.filter(isCompleteDecision),
});
