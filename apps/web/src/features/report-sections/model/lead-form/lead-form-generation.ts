import type { ReportSectionReadModel } from "@weeklyreport/shared";

export type LeadFormGeneration = `${string}:${string}`;

export function leadFormGenerationOf(
  section: Pick<ReportSectionReadModel, "reportId" | "reportSectionId">,
): LeadFormGeneration {
  return `${section.reportId}:${section.reportSectionId}`;
}
