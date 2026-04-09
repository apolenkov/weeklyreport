import {
  pdfExportJobSchema,
  type AssembledReport,
  type PdfExportJob,
} from '@customreport/shared';

export class PdfExportDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfExportDomainError';
  }
}

export interface PdfExportRepository {
  getPublishedReport(reportId: string): Promise<AssembledReport | null>;
  createExportJob(job: PdfExportJob): Promise<PdfExportJob>;
  getExportJob(jobId: string): Promise<PdfExportJob | null>;
  saveExportJob(job: PdfExportJob): Promise<PdfExportJob>;
}

export class PdfExportService {
  constructor(private readonly repository: PdfExportRepository) {}

  async requestPdfExport(reportId: string): Promise<PdfExportJob> {
    const report = await this.repository.getPublishedReport(reportId);

    if (!report || report.status !== 'published') {
      throw new PdfExportDomainError('PDF export requires a published report.');
    }

    return this.repository.createExportJob(
      pdfExportJobSchema.parse({
        jobId: crypto.randomUUID(),
        reportId,
        status: 'queued',
        requestedAt: new Date(),
        completedAt: null,
        checksum: null,
        templateVersion: 'phase-2-pdf-v1',
        artifactUrl: null,
      }),
    );
  }

  async getPdfExportStatus(jobId: string): Promise<PdfExportJob> {
    const job = await this.repository.getExportJob(jobId);

    if (!job) {
      throw new PdfExportDomainError(`PDF export job ${jobId} was not found.`);
    }

    return pdfExportJobSchema.parse(job);
  }

  async markExportCompleted(
    jobId: string,
    artifactUrl: string,
    checksum: string,
  ): Promise<PdfExportJob> {
    const job = await this.getPdfExportStatus(jobId);

    return this.repository.saveExportJob(
      pdfExportJobSchema.parse({
        ...job,
        status: 'completed',
        completedAt: new Date(),
        artifactUrl,
        checksum,
      }),
    );
  }
}
