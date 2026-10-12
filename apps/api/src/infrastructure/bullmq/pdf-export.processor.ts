import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { Inject, Injectable } from "@nestjs/common";
import { PDF_EXPORT_QUEUE_NAME } from "@weeklyreport/shared";
import { type Job, UnrecoverableError } from "bullmq";
import { ClsService } from "nestjs-cls";

import { APP_LOGGER } from "../../lib/audit-logger.js";
import { errorMessage } from "../../lib/error-message.js";
import type { AppLogger } from "../../lib/logger.js";
import {
  PDF_RENDERER,
  type PdfExportJobIdentity,
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
  jobDataStringField,
  type JobTraceContext,
} from "./worker-observability.js";

export {
  createDefaultPdfArtifactStore,
  type PdfArtifactAttempt,
  type PdfArtifactStore,
} from "./pdf-export.artifact-store.js";

// Same-origin artifact URL served by the API's static /pdfs mount
// (PDF_DOWNLOAD_ROUTE in bootstrap/http-access-log.ts). The download handler
// re-derives this exact shape before streaming a file, so the two must agree.
const pdfArtifactUrl = (jobId: string): string => `/pdfs/${jobId}.pdf`;

// A dispatch generation is an integer >= 1 stamped by the enqueuer. Redis
// payloads are untrusted: anything else is rejected rather than substituted
// with the durable row's current generation.
const isPdfExportGeneration = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1;

// The single queue addressing convention shared by dispatch, the worker's
// failure handler, and reconciliation lookups: `${jobId}-g${generation}`.
const pdfExportQueueJobId = (jobId: string, generation: number): string =>
  `${jobId}-g${generation}`;

// A queue job instance matches its payload only when BullMQ addressed it as
// exactly `${jobId}-g${generation}` — bare legacy ids, other generations,
// foreign ids, and id-less deliveries are all rejected rather than
// reconciled.
const matchesQueueJob = (
  job: { id?: string },
  identity: PdfExportJobIdentity,
): boolean =>
  job.id === pdfExportQueueJobId(identity.jobId, identity.generation);

interface PdfExportJobData extends JobTraceContext {
  reportId: string;
  jobId: string;
  // Monotonic dispatch generation of the durable row this job renders. The
  // queue id is `${jobId}-g${generation}`; a missing or malformed value is
  // rejected, never substituted.
  generation: number;
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
    super(
      env,
      logger.child({ service: "pdf-export-worker" }),
      cls,
      workerLiveness,
    );
  }

  // Awaiting markTerminalFailure keeps its rejection inside the worker's
  // failure-hook wrapper; a detached call could surface an unhandled
  // rejection when the payload is malformed.
  protected readonly onJobFailed = async (
    job: Job<PdfExportJobData> | undefined,
    error: Error,
  ): Promise<void> => {
    const { logFields: correlation } = describeJobFailureTrace(job?.data);
    // job.data is untrusted Redis JSON: identity extraction is null/primitive
    // safe, and a rejected identity still yields one diagnostic log.
    const identity = job ? pdfExportPayloadIdentity(job.data) : null;

    this.logger.error("pdf-export job failed", {
      jobId: identity?.jobId,
      reportId: identity?.reportId,
      attempt: job?.attemptsMade,
      ...correlation,
      error: error.message,
    });

    await this.markTerminalFailure(job, identity, correlation);
  };

  private async markTerminalFailure(
    job: Job<PdfExportJobData> | undefined,
    identity: PdfExportJobIdentity | null,
    correlation: Readonly<Record<string, string>>,
  ): Promise<void> {
    if (!job || !identity || !matchesQueueJob(job, identity)) {
      this.logger.error("pdf-export failed event identity rejected", {
        queueJobId: job?.id,
        jobId: jobDataStringField(job?.data, "jobId"),
      });
      return;
    }
    try {
      await this.pdfExportService.reconcileTerminalState(
        identity,
        // This event's failure was captured before the export row lock, so
        // the job object, its payload, and `error` are all stale. Inside the
        // lock, observe the live state first — then re-read the job itself:
        // BullMQ transitions are not serialized by the row lock, so that
        // snapshot's failedReason can already belong to an older attempt.
        async () => {
          const queue = this.queues.get(this.queueName);
          const queueJobId = pdfExportQueueJobId(
            identity.jobId,
            identity.generation,
          );
          const observed = await queue.getJob(queueJobId);
          if (!observed || (await observed.getState()) !== "failed") {
            return null;
          }
          const current = await queue.getJob(queueJobId);
          if (!current || (await current.getState()) !== "failed") {
            return null;
          }
          return currentFailedTerminalState(current);
        },
      );
    } catch (markError: unknown) {
      this.logger.error("pdf-export failed-state update failed", {
        jobId: identity.jobId,
        ...correlation,
        error: errorMessage(markError),
      });
    }
  }

  protected readonly processJob = async (
    job: Job<PdfExportJobData>,
  ): Promise<{ artifactUrl: string; checksum: string }> => {
    // Redis JSON is untrusted: a null or primitive payload cannot even be
    // destructured, so reject it unrecoverably before any identity, token,
    // render, or artifact work.
    const rawData: unknown = job.data;
    if (typeof rawData !== "object" || rawData === null) {
      throw new UnrecoverableError("pdf-export job payload is not an object");
    }
    const { reportId, jobId, requestedBy, generation } = job.data;
    // A payload without a valid generation can never render safely — fail the
    // job unrecoverably rather than substitute the row's current generation.
    if (!isPdfExportGeneration(generation)) {
      throw new UnrecoverableError(
        `pdf-export job ${jobId} payload is missing a valid generation`,
      );
    }
    // The dispatch contract addresses every queue job `${jobId}-g${generation}`:
    // a bare, foreign, or id-less delivery is as malformed as a bad generation
    // — reject it before durable identity, render, artifact, or write.
    if (!matchesQueueJob(job, job.data)) {
      throw new UnrecoverableError(
        `pdf-export job ${jobId} queue id ${job.id ?? "<missing>"} does not match generation ${generation}`,
      );
    }
    // Redis payloads are untrusted delivery data. Bind every identity field to
    // the immutable database job — which must be pending at exactly this
    // generation — before minting a token or opening the print route, so a
    // stale/tampered payload cannot render another report.
    await this.pdfExportService.assertPdfExportJobIdentity(
      jobId,
      reportId,
      requestedBy,
      generation,
    );
    const reportUrl = `${this.env.PDF_BASE_URL}/print/${reportId}?jobId=${encodeURIComponent(jobId)}`;

    // Mint the short-lived render JWT at execution time so a delayed queue job
    // never depends on a persisted bearer credential.
    const authToken = this.pdfExportService.signPdfExportToken(
      reportId,
      jobId,
      requestedBy,
    );
    const pdfBuffer = await this.timed(jobId, "renderer.render", () =>
      this.pdfRenderer.render({
        url: reportUrl,
        cookies: this.pdfExportService.buildAuthCookies(authToken),
        traceId: jobId,
      }),
    );

    return this.persistCompletedArtifact({
      artifactUrl: pdfArtifactUrl(jobId),
      jobId,
      generation,
      outputDir: resolve(this.env.PDF_OUTPUT_DIR),
      pdfBuffer,
    });
  };

  protected async persistCompletedArtifact(input: {
    artifactUrl: string;
    jobId: string;
    generation: number;
    outputDir: string;
    pdfBuffer: Buffer;
  }): Promise<{ artifactUrl: string; checksum: string }> {
    const artifactStore = this.createArtifactStore();
    const attempt = await artifactStore.createAttempt(
      input.outputDir,
      input.jobId,
      input.generation,
      input.pdfBuffer,
    );

    try {
      const checksum = await artifactStore.publishAndHash(attempt);
      await this.pdfExportService.markExportCompleted(
        input.jobId,
        input.generation,
        input.artifactUrl,
        checksum,
      );
      await this.cleanupAttempt(artifactStore, attempt, input.jobId, null);
      return { artifactUrl: input.artifactUrl, checksum };
    } catch (error) {
      await this.cleanupAttempt(artifactStore, attempt, input.jobId, {
        failed: error,
      });
      throw error;
    }
  }

  protected createArtifactStore(): PdfArtifactStore {
    return createDefaultPdfArtifactStore();
  }

  // `cause` distinguishes the two post-attempt paths: a publication failure
  // turns a cleanup failure into an AggregateError; after a completed write it
  // only warns — the durable row already owns the artifact.
  private async cleanupAttempt(
    artifactStore: PdfArtifactStore,
    attempt: PdfArtifactAttempt,
    jobId: string,
    cause: { failed: unknown } | null,
  ): Promise<void> {
    try {
      await artifactStore.cleanupAttempt(attempt);
    } catch (cleanupError) {
      if (cause !== null) {
        throw new AggregateError(
          [cause.failed, cleanupError],
          `failed to persist or remove PDF attempt for job ${jobId}`,
        );
      }
      this.logger.warn("pdf-export attempt cleanup failed after completion", {
        jobId,
        tempPath: attempt.tempPath,
        error: errorMessage(cleanupError),
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

// Redis payloads are untrusted delivery data: the failure-event guard and the
// locked re-read both parse identity fields through this one check.
function pdfExportPayloadIdentity(data: unknown): PdfExportJobIdentity | null {
  const { jobId, reportId, requestedBy, generation } = (
    typeof data === "object" && data !== null ? data : {}
  ) as Partial<PdfExportJobIdentity>;
  const malformed =
    [jobId, reportId, requestedBy].some(
      (value) => typeof value !== "string" || !value,
    ) || !isPdfExportGeneration(generation);
  return malformed
    ? null
    : ({ jobId, reportId, requestedBy, generation } as PdfExportJobIdentity);
}

// Terminal state built from the job as it is NOW, inside the export row
// lock: payload identity and failedReason are re-read from the current queue
// job, so a delayed failure event from an older attempt can neither stamp a
// stale reason nor write for a payload that no longer matches.
function currentFailedTerminalState(
  job: Job<unknown>,
): PdfExportTerminalState | null {
  const identity = pdfExportPayloadIdentity(job.data);
  if (!identity || !matchesQueueJob(job, identity)) {
    return null;
  }
  return {
    ...identity,
    status: "failed",
    ...(typeof job.failedReason === "string" && job.failedReason
      ? { error: job.failedReason }
      : {}),
  };
}
