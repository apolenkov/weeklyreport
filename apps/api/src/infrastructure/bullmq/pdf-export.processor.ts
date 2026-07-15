import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { Injectable } from "@nestjs/common";
import { type Job } from "bullmq";
import type { ClsService } from "nestjs-cls";
import { chromium, type Page } from "playwright";

import { requireEnv } from "../../lib/env.js";
import type { AppLogger } from "../../lib/logger.js";
import { PdfExportService } from "../../modules/pdf-export/index.js";
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
// after network idle before failing the job.
const PRINT_READY_TIMEOUT_MS = 30_000;

// Shared contract with the web print template
// (apps/web/src/app/print/[reportId]/print-report-template.tsx): it stamps
// data-print-state on the root of each render branch. The worker captures only
// the "ready" branch, so a loading spinner or terminal error page is never
// checksummed as a completed export. These strings MUST stay in sync with the
// template's PRINT_STATE tokens.
const PRINT_STATE_ATTR = "data-print-state";
const PRINT_STATE_READY = "ready";
const READY_OR_ERROR_SELECTOR =
  '[data-print-state="ready"], [data-print-state="error"]';

interface PdfExportJobData extends JobTraceContext {
  reportId: string;
  jobId: string;
  // Short-lived (5min) JWT injected into the Playwright browser context as the
  // session cookie before page.goto, so the print page's tRPC fetch carries an
  // authenticated session.
  authToken: string;
}

/** BullMQ worker for the pdf-export queue. */
@Injectable()
export class PdfExportProcessor extends RawBullMqProcessor<PdfExportJobData> {
  protected readonly queueName = "pdf-export";
  protected readonly spanName = "pdf-export.process";

  constructor(
    private readonly pdfExportService: PdfExportService,
    env: EnvConfig,
    logger?: AppLogger,
    cls?: ClsService,
  ) {
    super(env, logger, cls);
  }

  protected onJobFailed(
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
      const attemptsUsed = job.attemptsMade + 1;
      const maxAttempts = job.opts.attempts ?? 1;
      if (attemptsUsed >= maxAttempts) {
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
      // Never log the actual token; only its presence.
      authToken: job?.data.authToken ? "<redacted>" : "MISSING",
      ...correlation,
      error: error.message,
    });
  }

  protected async processJob(job: Job<PdfExportJobData>): Promise<void> {
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
      // Positive readiness gate: capture, write, and mark-completed run only once
      // the template reports "ready" — a spinner or error page throws instead,
      // routing through onJobFailed → markExportFailed.
      await this.assertPrintReady(page, jobId);
      const pdfBuffer = await this.timed(jobId, "page.pdf", () =>
        page.pdf({ format: "A4", printBackground: true }),
      );

      // Resolve to an absolute path so the API's static /pdfs mount and this
      // worker write to the same directory regardless of the process cwd.
      const outputDir = resolve(this.env.PDF_OUTPUT_DIR);
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

  /**
   * Wait for the print template's terminal render marker after network idle and
   * assert it is "ready". Throws when the "error" marker is present or when no
   * terminal marker appears within the timeout, so a failed render fails the job.
   */
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
