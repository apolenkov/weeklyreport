import {
  assembledReportSchema,
  archiveReportDetailSchema,
  archiveReportSummarySchema,
  draftSaveSchema,
  pdfExportJobSchema,
  reportSectionReadModelSchema,
  type ArchiveReportDetail,
  type ArchiveReportSummary,
  type AssembledReport,
  type DraftSavePayload,
  type PdfExportJob,
  type PortfolioOverview,
  type ReportSectionReadModel,
  type UserSession,
} from '@customreport/shared';

import { readStoredLeadSection } from '../report-section/section-storage';
import { createDemoSection } from '../report-section/demo-section';

export const PUBLISHED_REPORT_STORAGE_KEY = 'customreport:published-report';
export const PDF_EXPORT_JOB_STORAGE_KEY = 'customreport:pdf-export-job';
export const ARCHIVE_REPORTS_STORAGE_KEY = 'customreport:archive-reports';

const reportId = '22222222-2222-4222-8222-222222222222';

function createSeededSection(input: {
  reportSectionId: string;
  authorId: string;
  authorName: string;
  projectId: string;
  projectName: string;
  trafficLight: 'green' | 'yellow' | 'red' | null;
  status: 'draft' | 'submitted';
  submittedAt: Date | null;
}): ReportSectionReadModel {
  return reportSectionReadModelSchema.parse({
    reportSectionId: input.reportSectionId,
    reportId,
    authorId: input.authorId,
    authorName: input.authorName,
    status: input.status,
    submittedAt: input.submittedAt,
    projects: [
      {
        projectId: input.projectId,
        projectName: input.projectName,
        trafficLight: input.trafficLight,
      },
    ],
    items: [
      {
        projectId: input.projectId,
        type: 'current',
        text: `Current week update for ${input.projectName}`,
        tag: 'feature',
        workflowStatus: 'in_progress',
        carriedOver: false,
      },
    ],
    risks: [],
    decisions: [],
    priorities: [
      { rank: 1, text: `Priority 1 for ${input.projectName}` },
      { rank: 2, text: `Priority 2 for ${input.projectName}` },
      { rank: 3, text: `Priority 3 for ${input.projectName}` },
    ],
  });
}

const baseSections: ReportSectionReadModel[] = [
  createDemoSection(),
  createSeededSection({
    reportSectionId: '22222222-2222-4222-8222-222222222223',
    authorId: '33333333-3333-4333-8333-333333333334',
    authorName: 'Lead 2',
    projectId: '44444444-4444-4444-8444-444444444445',
    projectName: 'Project 2',
    trafficLight: 'yellow',
    status: 'draft',
    submittedAt: null,
  }),
  createSeededSection({
    reportSectionId: '22222222-2222-4222-8222-222222222224',
    authorId: '33333333-3333-4333-8333-333333333335',
    authorName: 'Lead 3',
    projectId: '44444444-4444-4444-8444-444444444446',
    projectName: 'Project 3',
    trafficLight: 'red',
    status: 'draft',
    submittedAt: null,
  }),
];

function sortSections(sections: ReportSectionReadModel[]): ReportSectionReadModel[] {
  return [...sections].sort((left, right) => left.authorName.localeCompare(right.authorName, 'ru'));
}

function buildPortfolioOverview(sections: ReportSectionReadModel[]): PortfolioOverview {
  const totals = sections.reduce(
    (summary, section) => {
      return section.projects.reduce((projectSummary, project) => {
        if (!project.trafficLight) {
          return projectSummary;
        }

        return {
          ...projectSummary,
          [project.trafficLight]: projectSummary[project.trafficLight] + 1,
        };
      }, summary);
    },
    {
      green: 0,
      yellow: 0,
      red: 0,
    },
  );

  return {
    status: totals.red > 0 ? 'red' : totals.yellow > 0 ? 'yellow' : 'green',
    totals,
  };
}

export function buildDraftAssembledReport(
  activeSection: ReportSectionReadModel = readStoredLeadSection(),
): AssembledReport {
  const mergedSections = baseSections.map((section) =>
    section.authorId === activeSection.authorId ? activeSection : section,
  );
  const sortedSections = sortSections(mergedSections);

  return assembledReportSchema.parse({
    reportId,
    periodStart: new Date('2026-04-06T00:00:00.000Z'),
    periodEnd: new Date('2026-04-12T23:59:59.000Z'),
    deadline: new Date('2026-04-10T15:00:00.000Z'),
    status: 'draft',
    publishedAt: null,
    publishedById: null,
    publishedByName: null,
    portfolioOverview: buildPortfolioOverview(sortedSections),
    sections: sortedSections,
  });
}

export function applyReviewSectionUpdate(
  report: AssembledReport,
  input: DraftSavePayload,
): AssembledReport {
  const parsedInput = draftSaveSchema.parse(input);

  if (report.status === 'published') {
    return report;
  }

  const nextSections = report.sections.map((section) => {
    if (section.reportSectionId !== parsedInput.reportSectionId) {
      return section;
    }

    return reportSectionReadModelSchema.parse({
      ...section,
      projects: section.projects.map((project) => ({
        ...project,
        trafficLight:
          parsedInput.projectStatuses.find((status) => status.projectId === project.projectId)
            ?.status ?? null,
      })),
      items: parsedInput.items.map((item) => ({
        ...item,
        carriedOver: item.carriedOver ?? false,
      })),
      risks: parsedInput.risks,
      decisions: parsedInput.decisions,
      priorities: parsedInput.priorities,
    });
  });

  const sortedSections = sortSections(nextSections);

  return assembledReportSchema.parse({
    ...report,
    portfolioOverview: buildPortfolioOverview(sortedSections),
    sections: sortedSections,
  });
}

export function publishReportSnapshot(
  report: AssembledReport,
  session: UserSession,
): AssembledReport {
  return assembledReportSchema.parse({
    ...report,
    status: 'published',
    publishedAt: new Date(),
    publishedById: session.userId,
    publishedByName: session.name,
  });
}

export function readPublishedReport(): AssembledReport | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(PUBLISHED_REPORT_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  return assembledReportSchema.parse(JSON.parse(rawValue));
}

export function persistPublishedReport(report: AssembledReport): AssembledReport {
  const parsedReport = assembledReportSchema.parse(report);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PUBLISHED_REPORT_STORAGE_KEY, JSON.stringify(parsedReport));
    const currentArchive = readArchiveReports();
    const nextSummary = archiveReportSummarySchema.parse({
      reportId: parsedReport.reportId,
      periodStart: parsedReport.periodStart,
      periodEnd: parsedReport.periodEnd,
      publishedAt: parsedReport.publishedAt ?? new Date(),
      publishedByName: parsedReport.publishedByName ?? 'Unknown',
      portfolioStatus: parsedReport.portfolioOverview.status,
    });
    const nextArchive = [
      ...currentArchive.filter((entry) => entry.summary.reportId !== parsedReport.reportId),
      archiveReportDetailSchema.parse({
        summary: nextSummary,
        report: parsedReport,
      }),
    ].sort(
      (left, right) => right.summary.publishedAt.getTime() - left.summary.publishedAt.getTime(),
    );
    window.localStorage.setItem(ARCHIVE_REPORTS_STORAGE_KEY, JSON.stringify(nextArchive));
  }

  return parsedReport;
}

export function readArchiveReports(): ArchiveReportDetail[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const rawValue = window.localStorage.getItem(ARCHIVE_REPORTS_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  return archiveReportDetailSchema.array().parse(JSON.parse(rawValue));
}

export function readArchiveReport(reportId: string): ArchiveReportDetail | null {
  return readArchiveReports().find((entry) => entry.summary.reportId === reportId) ?? null;
}

export function listArchiveReportSummaries(): ArchiveReportSummary[] {
  return readArchiveReports().map((entry) => archiveReportSummarySchema.parse(entry.summary));
}

export function readPdfExportJob(): PdfExportJob | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(PDF_EXPORT_JOB_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  return pdfExportJobSchema.parse(JSON.parse(rawValue));
}

export function persistPdfExportJob(job: PdfExportJob): PdfExportJob {
  const parsedJob = pdfExportJobSchema.parse(job);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PDF_EXPORT_JOB_STORAGE_KEY, JSON.stringify(parsedJob));
  }

  return parsedJob;
}

export function requestPdfExport(report: AssembledReport): PdfExportJob {
  return pdfExportJobSchema.parse({
    jobId: crypto.randomUUID(),
    reportId: report.reportId,
    status: 'queued',
    requestedAt: new Date(),
    completedAt: null,
    checksum: null,
    templateVersion: 'phase-2-pdf-v1',
    artifactUrl: null,
  });
}

export function completePdfExportJob(job: PdfExportJob): PdfExportJob {
  return pdfExportJobSchema.parse({
    ...job,
    status: 'completed',
    completedAt: new Date(),
    checksum: `checksum-${job.reportId}`,
    artifactUrl: `/exports/${job.reportId}.pdf`,
  });
}
