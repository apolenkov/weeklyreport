import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

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
      // TODO(Phase 24): inject session cookie via PdfExportService.buildAuthCookies +
      // page.context().addCookies() once auth guards land on tRPC. v5.0 relies on
      // AUTH_DEV_MODE=true on the API for unauthenticated tRPC fetches from
      // Playwright; the print page calls trpc.weeklyReport.get client-side.
      await page.goto(reportUrl, { waitUntil: 'networkidle' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
      });

      // Phase 23-01: resolve to an absolute path so the API's express.static
      // mount on /pdfs (apps/api/src/main.ts) and this worker write to the
      // same directory regardless of the process cwd.
      const outputDir = resolve(process.env['PDF_OUTPUT_DIR'] ?? './apps/api/storage/pdfs');
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
