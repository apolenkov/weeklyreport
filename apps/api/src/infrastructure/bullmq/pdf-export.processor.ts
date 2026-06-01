import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { type Job, Worker } from "bullmq";
import { chromium } from "playwright";

import type { PdfExportService } from "../../modules/pdf-export/pdf-export.service";
import { getBullMQOptions } from "./bullmq-options";

interface PdfExportJobData {
  reportId: string;
  jobId: string;
  // AUTH-05 (Phase 28-02): short-lived (5min) JWT injected into the
  // Playwright browser context as the AUTH_JWT_COOKIE_NAME cookie before
  // page.goto. Required so the print page's tRPC fetch carries an
  // authenticated session — closes the cookie seam left open in Phase 24.
  authToken: string;
}

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
      "pdf-export",
      async (job: Job<PdfExportJobData>) => {
        await this.processJob(job);
      },
      getBullMQOptions(),
    );

    this.worker.on("failed", (job, error) => {
      if (job?.data.jobId) {
        void this.pdfExportService
          .markExportFailed(job.data.jobId, error.message)
          .catch((markError: unknown) => {
            process.stderr.write(
              `${JSON.stringify({
                timestamp: new Date().toISOString(),
                level: "error",
                message: "pdf-export failed-state update failed",
                jobId: job.data.jobId,
                error:
                  markError instanceof Error
                    ? markError.message
                    : String(markError),
              })}\n`,
            );
          });
      }

      process.stderr.write(
        `${JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          message: "pdf-export job failed",
          jobId: job?.data.jobId,
          reportId: job?.data.reportId,
          attempt: job?.attemptsMade,
          // AUTH-05: never log the actual token; only its presence.
          authToken: job?.data.authToken ? "<redacted>" : "MISSING",
          error: error.message,
        })}\n`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processJob(job: Job<PdfExportJobData>): Promise<void> {
    const { reportId, jobId, authToken } = job.data;
    const baseUrl = process.env.PDF_BASE_URL ?? "http://localhost:3000";
    const reportUrl = `${baseUrl}/print/${reportId}`;

    const browser = await chromium.launch({ headless: true });
    try {
      // AUTH-05 (Phase 28-02): the auth cookie MUST be set before page.goto so
      // the print page's tRPC fetch carries customreport_session out of the
      // gate. Build via PdfExportService.buildAuthCookies which derives
      // domain/secure from PDF_BASE_URL — the contract Phase 27 left for us.
      const context = await browser.newContext();
      const cookies = this.pdfExportService.buildAuthCookies(authToken);
      await context.addCookies(cookies);
      const page = await context.newPage();
      await page.goto(reportUrl, { waitUntil: "networkidle" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
      });

      // Phase 23-01: resolve to an absolute path so the API's express.static
      // mount on /pdfs (apps/api/src/main.ts) and this worker write to the
      // same directory regardless of the process cwd. Default is relative to
      // the API package cwd (apps/api/) — see env.schema.ts for the same
      // anti-double-path rationale.
      const outputDir = resolve(process.env.PDF_OUTPUT_DIR ?? "./storage/pdfs");
      mkdirSync(outputDir, { recursive: true });

      const filePath = join(outputDir, `${jobId}.pdf`);
      writeFileSync(filePath, pdfBuffer);

      const checksum = createHash("sha256").update(pdfBuffer).digest("hex");
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
}
