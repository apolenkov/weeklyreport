import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { type Job, Worker } from "bullmq";
import type { ClsService } from "nestjs-cls";
import { chromium } from "playwright";

import { requireEnv } from "../../lib/env.js";
import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import { PdfExportService } from "../../modules/pdf-export/pdf-export.service";
import type { EnvConfig } from "../config/env.schema";
import { getBullMQOptions } from "./bullmq-options";
import {
  extractTraceId,
  type JobTraceContext,
  runInJobTraceContext,
} from "./worker-observability.js";

// Cap the render navigation so a hung print page fails the job instead of
// pinning a Chromium tab (and its Redis lock) indefinitely.
const PAGE_GOTO_TIMEOUT_MS = 60_000;

interface PdfExportJobData extends JobTraceContext {
  reportId: string;
  jobId: string;
  // Short-lived (5min) JWT injected into the Playwright browser context as the
  // session cookie before page.goto, so the print page's tRPC fetch carries an
  // authenticated session.
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
  private readonly logger: AppLogger;

  constructor(
    private readonly pdfExportService: PdfExportService,
    private readonly env: EnvConfig,
    logger?: AppLogger,
    private readonly cls?: ClsService,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  onModuleInit(): void {
    this.worker = new Worker<PdfExportJobData>(
      "pdf-export",
      async (job: Job<PdfExportJobData>) => {
        await runInJobTraceContext(
          job.data,
          "pdf-export.process",
          this.cls,
          () => this.processJob(job),
        );
      },
      getBullMQOptions(this.env),
    );

    this.worker.on("failed", (job, error) => {
      this.handleFailure(job, error);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private handleFailure(
    job: Job<PdfExportJobData> | undefined,
    error: Error,
  ): void {
    const correlationId = job?.data.correlationId;
    const traceId = job ? extractTraceId(job.data) : undefined;
    const correlation = {
      ...(correlationId ? { correlationId } : {}),
      ...(traceId ? { traceId } : {}),
    };

    if (job?.data.jobId) {
      void this.pdfExportService
        .markExportFailed(job.data.jobId, error.message)
        .catch((markError: unknown) => {
          this.logger.error("pdf-export failed-state update failed", {
            jobId: job.data.jobId,
            ...correlation,
            error:
              markError instanceof Error
                ? markError.message
                : String(markError),
          });
        });
    }

    this.logger.error("pdf-export job failed", {
      jobId: job?.data.jobId,
      reportId: job?.data.reportId,
      attempt: job?.attemptsMade,
      // Never log the actual token; only its presence.
      authToken: job?.data.authToken ? "<redacted>" : "MISSING",
      ...correlation,
      error: error.message,
    });
  }

  private async processJob(job: Job<PdfExportJobData>): Promise<void> {
    const { reportId, jobId, authToken } = job.data;
    const baseUrl = requireEnv(process.env, "PDF_BASE_URL");
    const reportUrl = `${baseUrl}/print/${reportId}`;

    const browser = await chromium.launch({ headless: true });
    try {
      // The auth cookie MUST be set before page.goto so the print page's tRPC
      // fetch carries the session out of the gate. buildAuthCookies derives
      // domain/secure from PDF_BASE_URL.
      const context = await browser.newContext();
      const cookies = this.pdfExportService.buildAuthCookies(authToken);
      await context.addCookies(cookies);
      const page = await context.newPage();
      await this.timed(jobId, "page.goto", () =>
        page.goto(reportUrl, {
          waitUntil: "networkidle",
          timeout: PAGE_GOTO_TIMEOUT_MS,
        }),
      );
      const pdfBuffer = await this.timed(jobId, "page.pdf", () =>
        page.pdf({ format: "A4", printBackground: true }),
      );

      // Resolve to an absolute path so the API's static /pdfs mount and this
      // worker write to the same directory regardless of the process cwd.
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

  private async timed<T>(
    jobId: string,
    step: string,
    run: () => Promise<T>,
  ): Promise<T> {
    const start = performance.now();
    const result = await run();
    this.logger.info("pdf-export step complete", {
      jobId,
      step,
      durationMs: Math.round(performance.now() - start),
    });
    return result;
  }
}
