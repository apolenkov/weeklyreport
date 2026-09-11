import {
  type AssembledReport,
  AUTH_COOKIE_NAME,
  type PdfExportJob,
  pdfExportJobSchema,
  type PublishedReportSnapshot,
  type UserSession,
} from "@customreport/shared";

import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import { requireEnv } from "../../lib/env.js";
import { type AppLogger } from "../../lib/logger";
import { buildPublishedReadModelFromSnapshot } from "../weekly-report/index.js";
import {
  type PdfExportEnqueuer,
  type PdfExportTelemetry,
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

export type PdfExportJobRecord = PdfExportJob & { requestedBy: string };

export interface PdfExportTerminalState {
  readonly jobId: string;
  readonly reportId: string;
  readonly requestedBy: string;
  readonly status: "completed" | "failed";
  readonly artifactUrl?: string;
  readonly checksum?: string;
  readonly error?: string;
}

export interface PdfExportRepository {
  getPublishedReportForExport(
    reportId: string,
    session: UserSession,
  ): Promise<AssembledReport | null>;
  // Requester identity is mandatory: a job without a requester is a caller
  // bug and must fail loud rather than be relabelled as a system actor.
  createExportJob(
    job: PdfExportJob,
    requestedBy: string,
    publicationSnapshot: AssembledReport,
  ): Promise<PdfExportJob>;
  getPublishedReportForJob(
    jobId: string,
  ): Promise<PublishedReportSnapshot | null>;
  getExportJob(jobId: string): Promise<PdfExportJobRecord | null>;
  saveExportJob(job: PdfExportJob): Promise<PdfExportJob>;
  markExportFailed(jobId: string, error: string): Promise<void>;
}

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

  /** Reconciles one durable BullMQ terminal state; DB terminal states win ties. */
  async reconcileTerminalState(
    state: PdfExportTerminalState,
  ): Promise<boolean> {
    const job = await this.repository.getExportJob(state.jobId);
    if (
      job?.status !== "queued" ||
      job.reportId !== state.reportId ||
      job.requestedBy !== state.requestedBy
    ) {
      if (job?.status === "queued") {
        this.logger.error("pdf-export terminal identity mismatch", {
          jobId: state.jobId,
          reportId: state.reportId,
          requestedBy: state.requestedBy,
        });
      }
      return false;
    }
    if (state.status === "failed") {
      await this.markExportFailed(
        state.jobId,
        state.error ?? "PDF export failed in BullMQ",
      );
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
    await this.markExportCompleted(
      state.jobId,
      state.artifactUrl,
      state.checksum,
    );
    return true;
  }

  // Prefer Playwright `url` over domain/secure inference from PDF_BASE_URL —
  // IP, localhost, and proxy hostnames reject or mis-scope domain cookies.
  buildAuthCookies(authToken: string): {
    name: string;
    value: string;
    url: string;
    httpOnly: boolean;
    sameSite: "Lax" | "Strict" | "None";
  }[] {
    const baseUrl = requireEnv(this.env, "PDF_BASE_URL");

    return [
      {
        name: AUTH_COOKIE_NAME,
        value: authToken,
        url: baseUrl,
        httpOnly: true,
        sameSite: "Lax",
      },
    ];
  }
}
