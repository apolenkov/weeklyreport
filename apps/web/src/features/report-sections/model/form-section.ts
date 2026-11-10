import {
  type AuthorReportSectionReadModel,
  isCompleteDecision,
  isCompleteRisk,
  type ReportSectionReadModel,
} from "@weeklyreport/shared";

/**
 * The author's section in the shape the form edits. A detail the author has
 * not written yet arrives as null and becomes an empty field, so an unfinished
 * risk or decision is an ordinary row with blanks; the draft payload turns the
 * blanks back into null when it saves.
 */
export function formSectionOf(
  section: AuthorReportSectionReadModel,
): ReportSectionReadModel {
  return {
    ...section,
    risks: section.risks.map((risk) => ({
      ...risk,
      impact: risk.impact ?? "",
      mitigation: risk.mitigation ?? "",
    })),
    decisions: section.decisions.map((decision) => ({
      ...decision,
      impact: decision.impact ?? "",
    })),
  };
}

/**
 * The same section without its unfinished risks and decisions: what a slide
 * or any other finished view of the report may show.
 */
export function finishedSectionOf(
  section: AuthorReportSectionReadModel,
): ReportSectionReadModel {
  return {
    ...section,
    risks: section.risks.filter(isCompleteRisk),
    decisions: section.decisions.filter(isCompleteDecision),
  };
}

/** A by-period read with its section in the shape the form edits. */
export function withFormSection<
  T extends { readonly section: AuthorReportSectionReadModel },
>(read: T): Omit<T, "section"> & { readonly section: ReportSectionReadModel } {
  return { ...read, section: formSectionOf(read.section) };
}

/**
 * A by-period read for the slides: `section` is what a slide may show, and
 * `editableSection` keeps the unfinished records so an inline save sends
 * them back unchanged.
 */
export function withSlideSections<
  T extends { readonly section: AuthorReportSectionReadModel },
>(
  read: T,
): Omit<T, "section"> & {
  readonly section: ReportSectionReadModel;
  readonly editableSection: ReportSectionReadModel;
} {
  return {
    ...read,
    section: finishedSectionOf(read.section),
    editableSection: formSectionOf(read.section),
  };
}
