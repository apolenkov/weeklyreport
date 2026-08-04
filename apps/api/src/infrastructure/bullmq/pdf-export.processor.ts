import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { Inject, Injectable } from "@nestjs/common";
import { type Job } from "bullmq";
import { ClsService } from "nestjs-cls";
import { chromium, type Page } from "playwright";

import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { PdfExportService } from "../../modules/pdf-export/index.js";
import { ENV_CONFIG } from "../config/config.module.js";
import type { EnvConfig } from "../config/env.schema";
import { RawBullMqProcessor } from "./raw-bullmq-processor.js";
import {
  extractTraceId,
  type JobTraceContext,
} from "./worker-observability.js";

// Cap the render navigation so a hung print page fails the job instead of
// pinning a Chromium tab (and its Redis lock) indefinitely.
const PAGE_GOTO_TIMEOUT_MS = 60_000;

// Cap how long the worker waits for the print template's terminal render marker
// after the DOM is available before failing the job.
const PRINT_READY_TIMEOUT_MS = 30_000;

// Must stay in sync with the web print template's PRINT_STATE tokens
// (print-report-template.tsx). Worker captures only "ready"; loading/error
// markers must never be checksummed as a completed export.
const PRINT_STATE_ATTR = "data-print-state";
const PRINT_STATE_READY = "ready";
const READY_OR_ERROR_SELECTOR =
  '[data-print-state="ready"], [data-print-state="error"]';

// Same-origin artifact URL served by the API's static /pdfs mount
// (PDF_DOWNLOAD_ROUTE in bootstrap/http-access-log.ts). The download handler
// re-derives this exact shape before streaming a file, so the two must agree.
const pdfArtifactUrl = (jobId: string): string => `/pdfs/${jobId}.pdf`;

interface PdfExportJobData extends JobTraceContext {
  reportId: string;
  jobId: string;
  // Non-credential requester identity. The worker mints a fresh short-lived
  // JWT from it at execution time so the durable payload never persists a
  // bearer credential.
  requestedBy: string;
}

@Injectable()
export class PdfExportProcessor extends RawBullMqProcessor<PdfExportJobData> {
  protected readonly queueName = "pdf-export";
  protected readonly spanName = "pdf-export.process";

  constructor(
    @Inject(PdfExportService)
    private readonly pdfExportService: PdfExportService,
    @Inject(ENV_CONFIG) env: EnvConfig,
    @Inject(APP_LOGGER) logger: AppLogger,
    @Inject(ClsService) cls: ClsService | null,
  ) {
    super(env, logger, cls);
  }

  protected readonly onJobFailed = (
    job: Job<PdfExportJobData> | undefined,
    error: Error,
  ): void => {
    const correlationId = job?.data.correlationId;
    const traceId = job ? extractTraceId(job.data) : undefined;
    const correlation = {
      ...(correlationId ? { correlationId } : {}),
      ...(traceId ? { traceId } : {}),
    };

    if (job?.data.jobId) {
      const maxAttempts = job.opts.attempts ?? 1;
      if (job.attemptsMade >= maxAttempts) {
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
    }

    this.logger.error("pdf-export job failed", {
      jobId: job?.data.jobId,
      reportId: job?.data.reportId,
      attempt: job?.attemptsMade,
      ...correlation,
      error: error.message,
    });
  };

  protected readonly processJob = async (
    job: Job<PdfExportJobData>,
  ): Promise<void> => {
    const { reportId, jobId, requestedBy } = job.data;
    const baseUrl = this.env.PDF_BASE_URL;
    const reportUrl = `${baseUrl}/print/${reportId}`;

    const browser = await chromium.launch({ headless: true });
    try {
      // Mint the short-lived render JWT now, at execution time: the durable job
      // never carried a credential, and a token signed at enqueue could expire
      // before a delayed/retried job runs.
      const authToken = this.pdfExportService.signPdfExportToken(
        reportId,
        requestedBy,
      );
      // The auth cookie MUST be set before page.goto so the print page's tRPC
      // fetch carries the session out of the gate. buildAuthCookies derives
      // domain/secure from PDF_BASE_URL.
      const context = await browser.newContext();
      const cookies = this.pdfExportService.buildAuthCookies(authToken);
      await context.addCookies(cookies);
      const page = await context.newPage();
      await this.timed(jobId, "page.goto", () =>
        page.goto(reportUrl, {
          waitUntil: "domcontentloaded",
          timeout: PAGE_GOTO_TIMEOUT_MS,
        }),
      );
      // Positive readiness gate: capture, write, and mark-completed run only once
      // the template reports "ready" — a spinner or error page throws instead,
      // routing through onJobFailed → markExportFailed.
      await this.assertPrintReady(page, jobId);
      await this.timed(jobId, "wait.fonts", () =>
        page.waitForFunction(
          () => document.fonts.status === "loaded",
          undefined,
          { timeout: PRINT_READY_TIMEOUT_MS },
        ),
      );
      const pdfBuffer = await this.timed(jobId, "page.pdf", () =>
        page.pdf({ format: "A4", printBackground: true }),
      );

      // Resolve to an absolute path so the API's static /pdfs mount and this
      // worker write to the same directory regardless of the process cwd.
      const outputDir = resolve(this.env.PDF_OUTPUT_DIR);
      await mkdir(outputDir, { recursive: true });

      const filePath = join(outputDir, `${jobId}.pdf`);
      const checksum = createHash("sha256").update(pdfBuffer).digest("hex");
      const artifactUrl = pdfArtifactUrl(jobId);
      await this.persistCompletedArtifact({
        artifactUrl,
        checksum,
        filePath,
        jobId,
        pdfBuffer,
      });
    } finally {
      await browser.close();
    }
  };

  private async assertPrintReady(page: Page, jobId: string): Promise<void> {
    const marker = await this.timed(jobId, "wait.ready", () =>
      page.waitForSelector(READY_OR_ERROR_SELECTOR, {
        state: "attached",
        timeout: PRINT_READY_TIMEOUT_MS,
      }),
    );
    const state = await marker.getAttribute(PRINT_STATE_ATTR);
    if (state !== PRINT_STATE_READY) {
      throw new Error(
        `print render did not reach ready state (${PRINT_STATE_ATTR}="${state ?? "unknown"}")`,
      );
    }
  }

  private async persistCompletedArtifact(input: {
    artifactUrl: string;
    checksum: string;
    filePath: string;
    jobId: string;
    pdfBuffer: Buffer;
  }): Promise<void> {
    try {
      // Async I/O: a multi-MB PDF write must not block the event loop, which
      // also serves other queue workers on this process.
      await writeFile(input.filePath, input.pdfBuffer);
      await this.pdfExportService.markExportCompleted(
        input.jobId,
        input.artifactUrl,
        input.checksum,
      );
    } catch (error) {
      try {
        await rm(input.filePath, { force: true });
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          `failed to persist or remove PDF artifact for job ${input.jobId}`,
        );
      }
      throw error;
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
