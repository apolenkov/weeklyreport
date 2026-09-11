import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { PDF_EXPORT_QUEUE_NAME } from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";
import { type Job } from "bullmq";
import { ClsService } from "nestjs-cls";
import { chromium, type Page } from "playwright";

import { APP_LOGGER } from "../../lib/audit-logger.js";
import { errorMessage } from "../../lib/error-message.js";
import type { AppLogger } from "../../lib/logger.js";
import { PdfExportService } from "../../modules/pdf-export/index.js";
import { ENV_CONFIG } from "../config/config.module.js";
import type { EnvConfig } from "../config/env.schema";
import {
  createDefaultPdfArtifactStore,
  type PdfArtifactAttempt,
  type PdfArtifactStore,
} from "./pdf-export.artifact-store.js";
import { RawBullMqProcessor } from "./raw-bullmq-processor.js";
import { WorkerLivenessRegistry } from "./worker-liveness.registry.js";
import {
  describeJobFailureTrace,
  type JobTraceContext,
} from "./worker-observability.js";

export {
  createDefaultPdfArtifactStore,
  type PdfArtifactAttempt,
  type PdfArtifactStore,
} from "./pdf-export.artifact-store.js";

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
  protected readonly queueName = PDF_EXPORT_QUEUE_NAME;
  protected readonly spanName = "pdf-export.process";

  constructor(
    @Inject(PdfExportService)
    private readonly pdfExportService: PdfExportService,
    @Inject(ENV_CONFIG) env: EnvConfig,
    @Inject(APP_LOGGER) logger: AppLogger,
    @Inject(ClsService) cls: ClsService | null,
    @Inject(WorkerLivenessRegistry)
    workerLiveness?: WorkerLivenessRegistry,
  ) {
    super(env, logger, cls, workerLiveness);
  }

  protected readonly onJobFailed = (
    job: Job<PdfExportJobData> | undefined,
    error: Error,
  ): void => {
    const { logFields: correlation } = describeJobFailureTrace(job?.data);
    void this.markTerminalFailure(job, error, correlation);

    this.logger.error("pdf-export job failed", {
      jobId: job?.data.jobId,
      reportId: job?.data.reportId,
      attempt: job?.attemptsMade,
      ...correlation,
      error: error.message,
    });
  };

  private async markTerminalFailure(
    job: Job<PdfExportJobData> | undefined,
    error: Error,
    correlation: Readonly<Record<string, string>>,
  ): Promise<void> {
    if (
      !job?.data.jobId ||
      !job.data.reportId ||
      !job.data.requestedBy ||
      (job.id !== undefined && job.id !== job.data.jobId)
    ) {
      this.logger.error("pdf-export failed event identity rejected", {
        queueJobId: job?.id,
        jobId: job?.data.jobId,
      });
      return;
    }
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return;
    try {
      await this.pdfExportService.reconcileTerminalState({
        jobId: job.data.jobId,
        reportId: job.data.reportId,
        requestedBy: job.data.requestedBy,
        status: "failed",
        error: error.message,
      });
    } catch (markError: unknown) {
      this.logger.error("pdf-export failed-state update failed", {
        jobId: job.data.jobId,
        ...correlation,
        error: errorMessage(markError),
      });
    }
  }

  protected readonly processJob = async (
    job: Job<PdfExportJobData>,
  ): Promise<{ artifactUrl: string; checksum: string }> => {
    const { reportId, jobId, requestedBy } = job.data;
    // Redis payloads are untrusted delivery data. Bind every identity field to
    // the immutable database job before minting a token or opening the print
    // route, so a stale/tampered payload cannot render another report.
    await this.pdfExportService.assertPdfExportJobIdentity(
      jobId,
      reportId,
      requestedBy,
    );
    const baseUrl = this.env.PDF_BASE_URL;
    const reportUrl = `${baseUrl}/print/${reportId}?jobId=${encodeURIComponent(jobId)}`;

    const browser = await chromium.launch({ headless: true });
    try {
      // Mint the short-lived render JWT now, at execution time: the durable job
      // never carried a credential, and a token signed at enqueue could expire
      // before a delayed/retried job runs.
      const authToken = this.pdfExportService.signPdfExportToken(
        reportId,
        jobId,
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
      // routing through onJobFailed → terminal-state reconciliation.
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

      const outputDir = resolve(this.env.PDF_OUTPUT_DIR);
      const artifactUrl = pdfArtifactUrl(jobId);
      return await this.persistCompletedArtifact({
        artifactUrl,
        jobId,
        outputDir,
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

  protected async persistCompletedArtifact(input: {
    artifactUrl: string;
    jobId: string;
    outputDir: string;
    pdfBuffer: Buffer;
  }): Promise<{ artifactUrl: string; checksum: string }> {
    const artifactStore = this.createArtifactStore();
    const attempt = await artifactStore.createAttempt(
      input.outputDir,
      input.jobId,
      input.pdfBuffer,
    );

    try {
      const checksum = await artifactStore.publishAndHash(attempt);
      await this.pdfExportService.markExportCompleted(
        input.jobId,
        input.artifactUrl,
        checksum,
      );
      await this.cleanupCompletedAttempt(artifactStore, attempt, input.jobId);
      return { artifactUrl: input.artifactUrl, checksum };
    } catch (error) {
      await this.cleanupFailedAttempt(
        artifactStore,
        attempt,
        input.jobId,
        error,
      );
      throw error;
    }
  }

  protected createArtifactStore(): PdfArtifactStore {
    return createDefaultPdfArtifactStore();
  }

  private async cleanupFailedAttempt(
    artifactStore: PdfArtifactStore,
    attempt: PdfArtifactAttempt,
    jobId: string,
    originalError: unknown,
  ): Promise<void> {
    try {
      await artifactStore.cleanupAttempt(attempt);
    } catch (cleanupError) {
      throw new AggregateError(
        [originalError, cleanupError],
        `failed to persist or remove PDF attempt for job ${jobId}`,
      );
    }
  }

  private async cleanupCompletedAttempt(
    artifactStore: PdfArtifactStore,
    attempt: PdfArtifactAttempt,
    jobId: string,
  ): Promise<void> {
    try {
      await artifactStore.cleanupAttempt(attempt);
    } catch (cleanupError) {
      this.logger.warn("pdf-export attempt cleanup failed after completion", {
        jobId,
        tempPath: attempt.tempPath,
        error:
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError),
      });
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
