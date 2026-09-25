import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { PDF_EXPORT_QUEUE_NAME } from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";
import { type Job } from "bullmq";
import { ClsService } from "nestjs-cls";

import { APP_LOGGER } from "../../lib/audit-logger.js";
import { errorMessage } from "../../lib/error-message.js";
import type { AppLogger } from "../../lib/logger.js";
import {
  PDF_RENDERER,
  PdfExportService,
  type PdfExportTerminalState,
  type PdfRenderer,
} from "../../modules/pdf-export/index.js";
import { ENV_CONFIG } from "../config/config.module.js";
import type { EnvConfig } from "../config/env.schema";
import {
  createDefaultPdfArtifactStore,
  type PdfArtifactAttempt,
  type PdfArtifactStore,
} from "./pdf-export.artifact-store.js";
import { QueueRegistry } from "./queue-registry.js";
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

// Readiness moved into the render request itself: the renderer's
// waitForExpression gates capture on `[data-print-state="ready"]` plus loaded
// fonts, so a spinner or error page fails the conversion instead of producing
// artifact bytes.

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
    @Inject(PDF_RENDERER)
    private readonly pdfRenderer: PdfRenderer,
    @Inject(ENV_CONFIG) env: EnvConfig,
    @Inject(APP_LOGGER) logger: AppLogger,
    @Inject(ClsService) cls: ClsService | null,
    @Inject(QueueRegistry)
    private readonly queues: Pick<QueueRegistry, "get">,
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
    void this.markTerminalFailure(job, correlation);

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
    // No attemptsMade gate here: a BullMQ UnrecoverableError can mark a job
    // failed with attempts remaining, so terminality is decided by the
    // generation-scoped queue-state re-read inside the export-row lock.
    const identity = {
      jobId: job.data.jobId,
      reportId: job.data.reportId,
      requestedBy: job.data.requestedBy,
    };
    try {
      await this.pdfExportService.reconcileTerminalState(
        identity,
        // This event's failure was captured before the export row lock, so
        // the job object, its payload, and `error` are all stale. Inside the
        // lock, observe the live state first — then re-read the job itself:
        // BullMQ transitions are not serialized by the row lock, so that
        // snapshot's failedReason can already belong to an older attempt.
        async () => {
          const observed = await this.queues
            .get(this.queueName)
            .getJob(identity.jobId);
          if (!observed || (await observed.getState()) !== "failed") {
            return null;
          }
          const current = await this.queues
            .get(this.queueName)
            .getJob(identity.jobId);
          if (!current || (await current.getState()) !== "failed") {
            return null;
          }
          return currentFailedTerminalState(current);
        },
      );
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

    // Mint the short-lived render JWT now, at execution time: the durable job
    // never carried a credential, and a token signed at enqueue could expire
    // before a delayed/retried job runs.
    const authToken = this.pdfExportService.signPdfExportToken(
      reportId,
      jobId,
      requestedBy,
    );
    // The credential rides the renderer's `cookies` field scoped to the
    // print-origin host (buildAuthCookies derives domain from PDF_BASE_URL).
    const pdfBuffer = await this.timed(jobId, "renderer.render", () =>
      this.pdfRenderer.render({
        url: reportUrl,
        cookies: this.pdfExportService.buildAuthCookies(authToken),
        traceId: jobId,
      }),
    );

    const outputDir = resolve(this.env.PDF_OUTPUT_DIR);
    const artifactUrl = pdfArtifactUrl(jobId);
    return this.persistCompletedArtifact({
      artifactUrl,
      jobId,
      outputDir,
      pdfBuffer,
    });
  };

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

// Terminal state built from the job as it is NOW, inside the export row
// lock: payload identity and failedReason are re-read from the current queue
// job, so a delayed failure event from an older attempt can neither stamp a
// stale reason nor write for a payload that no longer matches.
function currentFailedTerminalState(
  job: Job<unknown>,
): PdfExportTerminalState | null {
  const data =
    typeof job.data === "object" && job.data !== null
      ? (job.data as {
          jobId?: unknown;
          reportId?: unknown;
          requestedBy?: unknown;
        })
      : null;
  const jobId = typeof data?.jobId === "string" ? data.jobId : "";
  const reportId = typeof data?.reportId === "string" ? data.reportId : "";
  const requestedBy =
    typeof data?.requestedBy === "string" ? data.requestedBy : "";
  if (!jobId || !reportId || !requestedBy) return null;
  if (job.id !== undefined && job.id !== jobId) return null;
  return {
    jobId,
    reportId,
    requestedBy,
    status: "failed",
    ...(typeof job.failedReason === "string" && job.failedReason
      ? { error: job.failedReason }
      : {}),
  };
}
