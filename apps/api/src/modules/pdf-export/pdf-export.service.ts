import {
  AUTH_COOKIE_NAME,
  type PdfExportJob,
  pdfExportJobSchema,
  type UserSession,
} from "@customreport/shared";

import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import { requireEnv } from "../../lib/env.js";
import { type AppLogger } from "../../lib/logger";
import { buildPublishedReadModelFromSnapshot } from "../weekly-report/index.js";
import {
  type PdfExportEnqueuer,
  type PdfExportJobIdentity,
  type PdfExportRepository,
  type PdfExportRetryOutcome,
  type PdfExportRetryQueue,
  type PdfExportTelemetry,
  type PdfExportTerminalState,
} from "./pdf-export.ports.js";
import { signPdfExportToken as signPdfExportTokenPure } from "./pdf-export.token.js";

export class PdfExportDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfExportDomainError";
  }
}

// Template id stamped on every created export job; read paths round-trip the
// persisted value rather than relabel with the running constant.
const PDF_EXPORT_TEMPLATE_VERSION = "phase-2-pdf-v1";

// Telemetry role label for non-tRPC callers (workers/cron) with no session role.
const SYSTEM_ROLE_LABEL = "system";

export class PdfExportService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: PdfExportRepository,
    logger: AppLogger,
    private readonly pdfQueue: PdfExportEnqueuer,
    private readonly telemetry: PdfExportTelemetry,
    private readonly env: Pick<
      EnvConfig,
      "PDF_BASE_URL" | "PDF_EXPORT_JWT_SECRET"
    >,
  ) {
    this.logger = logger;
  }

  // Throws PdfExportDomainError (tRPC → 500) if the secret is missing/too short —
  // fail loud at request time rather than mint an unverifiable token.
  signPdfExportToken(
    reportId: string,
    jobId: string,
    requestedBy: string,
  ): string {
    try {
      return signPdfExportTokenPure(
        reportId,
        jobId,
        requestedBy,
        this.env.PDF_EXPORT_JWT_SECRET,
      );
    } catch (error) {
      throw new PdfExportDomainError(
        error instanceof Error
          ? error.message
          : "PDF_EXPORT_JWT_SECRET is missing or too short (must be >= 32 chars).",
      );
    }
  }

  async requestPdfExport(
    reportId: string,
    session: UserSession,
    // Role label for customreport_pdf_export_requests_total; worker/cron default to 'system'.
    requestedByRole?: string,
  ): Promise<PdfExportJob> {
    const report = await this.repository.getPublishedReportForExport(
      reportId,
      session,
    );

    if (!report) {
      throw new PdfExportDomainError(
        "PDF export is not available for this caller.",
      );
    }
    if (report.status !== "published") {
      throw new PdfExportDomainError("PDF export requires a published report.");
    }

    this.logger.info("requesting PDF export", {
      reportId,
      requestedBy: session.userId,
    });
    const job = await this.repository.createExportJob(
      pdfExportJobSchema.parse({
        jobId: crypto.randomUUID(),
        reportId,
        status: "queued",
        requestedAt: new Date(),
        completedAt: null,
        checksum: null,
        templateVersion: PDF_EXPORT_TEMPLATE_VERSION,
        artifactUrl: null,
      }),
      session.userId,
      report,
    );

    // The durable job carries only non-credential identifiers; the worker
    // mints a fresh short-lived token from them at execution time, so a
    // persisted payload never holds a bearer credential.
    try {
      await this.pdfQueue.enqueue(
        { reportId, jobId: job.jobId, requestedBy: session.userId },
        this.telemetry.captureJobContext(),
      );
    } catch (error) {
      // A row must never stay "queued" with no job behind it: mark it failed
      // so status/reaper surfaces the breakage, then propagate the enqueue
      // error to the caller.
      await this.markExportFailed(
        job.jobId,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
    this.logger.info("enqueued pdf-export job", {
      jobId: job.jobId,
      reportId,
    });

    this.telemetry.recordRequest(requestedByRole ?? SYSTEM_ROLE_LABEL);

    return job;
  }

  async getPdfExportRender(
    jobId: string,
    requestedBy: string,
    reportId: string,
  ): Promise<ReturnType<typeof buildPublishedReadModelFromSnapshot>> {
    const job = await this.repository.getExportJob(jobId);
    if (job?.requestedBy !== requestedBy || job.reportId !== reportId) {
      throw new PdfExportDomainError(`PDF export job ${jobId} was not found.`);
    }
    const snapshot = await this.repository.getPublishedReportForJob(jobId);
    if (!snapshot) {
      throw new PdfExportDomainError(`PDF export job ${jobId} was not found.`);
    }
    return buildPublishedReadModelFromSnapshot(snapshot, {
      periodState: "published",
      periodStatus: "published",
      archived: false,
      weekLabel: null,
    });
  }

  async getPdfExportStatus(
    jobId: string,
    requestedBy: string,
  ): Promise<PdfExportJob> {
    const job = await this.repository.getExportJob(jobId);

    if (job?.requestedBy !== requestedBy) {
      throw new PdfExportDomainError(`PDF export job ${jobId} was not found.`);
    }

    return pdfExportJobSchema.parse(job);
  }

  /** Validates the queue payload against the immutable persisted job identity. */
  async assertPdfExportJobIdentity(
    jobId: string,
    reportId: string,
    requestedBy: string,
  ): Promise<void> {
    const job = await this.repository.getExportJob(jobId);
    if (job?.reportId !== reportId || job.requestedBy !== requestedBy) {
      throw new PdfExportDomainError(`PDF export job ${jobId} was not found.`);
    }
  }

  async markExportCompleted(
    jobId: string,
    artifactUrl: string,
    checksum: string,
  ): Promise<PdfExportJob> {
    const job = await this.repository.getExportJob(jobId);
    if (!job) {
      throw new PdfExportDomainError(`PDF export job ${jobId} was not found.`);
    }

    this.logger.info("marking PDF export completed", { jobId });
    return this.repository.saveExportJob(
      pdfExportJobSchema.parse({
        ...job,
        status: "completed",
        completedAt: new Date(),
        artifactUrl,
        checksum,
      }),
    );
  }

  async markExportFailed(jobId: string, error: string): Promise<void> {
    this.logger.error("PDF export job failed", { jobId, error });
    await this.repository.markExportFailed(jobId, error);
  }

  /**
   * Reconciles a terminal queue state to the durable export row under the
   * per-export row lock. `loadCurrentTerminalState` re-reads the queue AFTER
   * the lock is held, so a state captured before it (for example a failure
   * whose job has since been retried) can never overwrite a newer attempt.
   */
  async reconcileTerminalState(
    identity: PdfExportJobIdentity,
    loadCurrentTerminalState: () => Promise<PdfExportTerminalState | null>,
  ): Promise<boolean> {
    return this.repository.runLockedExportJob(
      identity.jobId,
      async (job, writes) => {
        if (job?.status !== "queued") {
          return false;
        }
        const state = await loadCurrentTerminalState();
        if (state === null) {
          return false;
        }
        if (
          state.jobId !== identity.jobId ||
          state.reportId !== identity.reportId ||
          state.requestedBy !== identity.requestedBy ||
          job.reportId !== identity.reportId ||
          job.requestedBy !== identity.requestedBy
        ) {
          this.logger.error("pdf-export terminal identity mismatch", {
            jobId: state.jobId,
            reportId: state.reportId,
            requestedBy: state.requestedBy,
          });
          return false;
        }
        if (state.status === "failed") {
          await writes.markFailed(state.error ?? "PDF export failed in BullMQ");
          return true;
        }
        if (!state.artifactUrl || !state.checksum) {
          this.logger.error(
            "pdf-export completed job has no durable artifact result",
            {
              jobId: state.jobId,
            },
          );
          return false;
        }
        await writes.markCompleted(state.artifactUrl, state.checksum);
        return true;
      },
    );
  }

  /**
   * Coordinated manual retry of a terminally failed export. The durable
   * failed→pending revival commits only if queue.retry resolves first, so a
   * rejected retry rolls the Postgres transaction back with the row left
   * failed. Only Postgres rolls back — a lost Redis ack or a failed Postgres
   * commit leaves the queue-side outcome uncertain and is never compensated.
   */
  async retryFailedExport(input: {
    identity: PdfExportJobIdentity;
    queue: PdfExportRetryQueue;
  }): Promise<PdfExportRetryOutcome> {
    const { identity, queue } = input;
    return this.repository.runLockedExportJob(
      identity.jobId,
      async (job, writes) => {
        if (
          job?.status !== "failed" ||
          job.reportId !== identity.reportId ||
          job.requestedBy !== identity.requestedBy
        ) {
          this.logger.info(
            "pdf-export manual retry declined: no matching failed export",
            {
              jobId: identity.jobId,
              reportId: identity.reportId,
            },
          );
          return "ineligible";
        }
        if (!(await queue.isFailed())) {
          return "queue-not-failed";
        }
        await writes.reviveFailed();
        await queue.retry();
        this.logger.info("pdf-export manual retry revived the export", {
          jobId: identity.jobId,
          reportId: identity.reportId,
        });
        return "retried";
      },
    );
  }

  // Gotenberg `cookies` field shape: the jar is keyed by `domain`, not `url`.
  // A single-label host (compose `web`, or localhost in host-source dev) is
  // probe-verified to reach the main document and same-origin subrequests.
  buildAuthCookies(authToken: string): {
    name: string;
    value: string;
    domain: string;
    path: string;
    httpOnly: boolean;
    sameSite: "Lax" | "Strict" | "None";
  }[] {
    const baseUrl = requireEnv(this.env, "PDF_BASE_URL");

    return [
      {
        name: AUTH_COOKIE_NAME,
        value: authToken,
        domain: new URL(baseUrl).hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ];
  }
}
