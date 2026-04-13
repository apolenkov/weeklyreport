import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
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
 * BullMQ worker for the pdf-export queue.
 *
 * Uses raw Worker (not @Processor/WorkerHost) to avoid the DiscoveryService
 * DI bug in @nestjs/bullmq 11 with NestJS 11.
 */
@Injectable()
export class PdfExportProcessor implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<PdfExportJobData> | undefined;

  constructor(private readonly pdfExportService: PdfExportService) {}

  onModuleInit(): void {
    this.worker = new Worker<PdfExportJobData>(
      'pdf-export',
      async (job: Job<PdfExportJobData>) => {
        await this.processJob(job);
      },
      {
        connection: {
          host: process.env['REDIS_HOST'] ?? 'localhost',
          port: Number(process.env['REDIS_PORT'] ?? 6379),
          maxRetriesPerRequest: null,
        },
      },
    );

    this.worker.on('failed', (job, error) => {
      process.stderr.write(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'pdf-export job failed',
          jobId: job?.data.jobId,
          reportId: job?.data.reportId,
          attempt: job?.attemptsMade,
          error: error.message,
        }) + '\n',
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(job: Job<PdfExportJobData>): Promise<void> {
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

      const outputDir = join(process.env['PDF_OUTPUT_DIR'] ?? '/app/data/pdfs');
      mkdirSync(outputDir, { recursive: true });

      const filePath = join(outputDir, `${jobId}.pdf`);
      writeFileSync(filePath, pdfBuffer);

      const checksum = createHash('sha256').update(pdfBuffer).digest('hex');
      const artifactUrl = `/pdfs/${jobId}.pdf`;

      await this.pdfExportService.markExportCompleted(jobId, artifactUrl, checksum);
    } finally {
      await browser.close();
    }
  }
}
