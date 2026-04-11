import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { PdfExportService } from '../../modules/pdf-export/pdf-export.service';

type PdfExportJobData = {
  reportId: string;
  jobId: string;
};

/**
 * BullMQ processor for the pdf-export queue.
 *
 * Launches a headless Chromium browser via Playwright, navigates to the
 * published report's print page, generates a PDF, saves it to the filesystem,
 * computes a SHA-256 checksum, and marks the export job as completed.
 */
@Injectable()
@Processor('pdf-export')
export class PdfExportProcessor extends WorkerHost {
  constructor(private readonly pdfExportService: PdfExportService) {
    super();
  }

  async process(job: Job<PdfExportJobData>): Promise<void> {
    const { reportId, jobId } = job.data;
    const baseUrl = process.env['PDF_BASE_URL'] ?? 'http://localhost:3000';
    const reportUrl = `${baseUrl}/reports/${reportId}/print`;

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(reportUrl, { waitUntil: 'networkidle' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
      });

      const outputDir = join(
        process.env['PDF_OUTPUT_DIR'] ?? '/app/data/pdfs',
      );
      mkdirSync(outputDir, { recursive: true });

      const filePath = join(outputDir, `${jobId}.pdf`);
      writeFileSync(filePath, pdfBuffer);

      const checksum = createHash('sha256').update(pdfBuffer).digest('hex');
      const artifactUrl = `/pdfs/${jobId}.pdf`;

      await this.pdfExportService.markExportCompleted(
        jobId,
        artifactUrl,
        checksum,
      );
    } finally {
      await browser.close();
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PdfExportJobData>, error: Error): void {
    process.stderr.write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'pdf-export job failed',
        jobId: job.data.jobId,
        reportId: job.data.reportId,
        attempt: job.attemptsMade,
        error: error.message,
      }) + '\n',
    );
  }
}
