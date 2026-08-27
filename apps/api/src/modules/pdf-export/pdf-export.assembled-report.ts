import {
  type AssembledReport,
  assembledReportSchema,
} from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import {
  computePortfolioOverviewFromReadSections,
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "../report-sections/index.js";

export const reportFullInclude = {
  sections: { include: reportSectionFullInclude },
  publishedBy: true,
} as const;

export function toAssembledReport(
  report: Prisma.ReportGetPayload<{ include: typeof reportFullInclude }>,
): AssembledReport {
  const sections = report.sections.map(mapPrismaToReportSection);
  const portfolio = computePortfolioOverviewFromReadSections(sections);
  return assembledReportSchema.parse({
    reportId: report.id,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    deadline: report.deadline,
    status: report.status,
    publishedAt: report.publishedAt,
    publishedById: report.publishedById,
    publishedByName: report.publishedBy?.name ?? null,
    portfolioOverview: portfolio,
    sections,
  });
}
