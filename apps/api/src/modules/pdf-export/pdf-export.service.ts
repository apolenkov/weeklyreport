import {
  type AssembledReport,
  type PdfExportJob,
  pdfExportJobSchema,
  type UserSession,
} from "@customreport/shared";

import { requireEnv } from "../../lib/env.js";
import { type AppLogger, createNullLogger } from "../../lib/logger";
import { resolveSessionCookieName } from "../../lib/session-cookie.js";
import {
  NOOP_PDF_EXPORT_TELEMETRY,
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

// Persisted template id for the phase-2 PDF layout; enqueue and read paths must agree.
export const PDF_EXPORT_TEMPLATE_VERSION = "phase-2-pdf-v1";

// Telemetry role label for non-tRPC callers (workers/cron) with no session role.
const SYSTEM_ROLE_LABEL = "system";

export type PdfExportJobRecord = PdfExportJob & { requestedBy: string };

export interface PdfExportRepository {
  getPublishedReport(reportId: string): Promise<AssembledReport | null>;
  canReadReport(session: UserSession, reportId: string): Promise<boolean>;
  // requestedBy is optional for non-tRPC callers (workers/scripts); prisma falls back to 'system'.
  createExportJob(
    job: PdfExportJob,
    requestedBy?: string,
  ): Promise<PdfExportJob>;
  getExportJob(jobId: string): Promise<PdfExportJobRecord | null>;
  saveExportJob(job: PdfExportJob): Promise<PdfExportJob>;
  markExportFailed(jobId: string, error: string): Promise<void>;
}

export class PdfExportService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: PdfExportRepository,
    logger: AppLogger | undefined,
    private readonly pdfQueue: PdfExportEnqueuer,
    private readonly telemetry: PdfExportTelemetry = NOOP_PDF_EXPORT_TELEMETRY,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  // Throws PdfExportDomainError (tRPC → 500) if the secret is missing/too short —
  // fail loud at request time rather than mint an unverifiable token.
  signPdfExportToken(reportId: string, requestedBy?: string): string {
    try {
      return signPdfExportTokenPure(reportId, requestedBy);
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
    authToken?: string,
    // Role label for customreport_pdf_export_requests_total; worker/cron default to 'system'.
    requestedByRole?: string,
  ): Promise<PdfExportJob> {
    const report = await this.repository.getPublishedReport(reportId);

    if (report?.status !== "published") {
      throw new PdfExportDomainError("PDF export requires a published report.");
    }

    if (!(await this.repository.canReadReport(session, reportId))) {
      throw new PdfExportDomainError(
        "PDF export is not available for this caller.",
      );
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
    );

    const cookieToken =
      authToken ?? this.signPdfExportToken(reportId, session.userId);
    await this.pdfQueue.enqueue(
      { reportId, jobId: job.jobId, authToken: cookieToken },
      this.telemetry.captureJobContext(),
    );
    this.logger.info("enqueued pdf-export job", {
      jobId: job.jobId,
      reportId,
    });

    this.telemetry.recordRequest(requestedByRole ?? SYSTEM_ROLE_LABEL);

    return job;
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

  // Prefer Playwright `url` over domain/secure inference from PDF_BASE_URL —
  // IP, localhost, and proxy hostnames reject or mis-scope domain cookies.
  buildAuthCookies(authToken: string): {
    name: string;
    value: string;
    url: string;
    httpOnly: boolean;
    sameSite: "Lax" | "Strict" | "None";
  }[] {
    const cookieName = resolveSessionCookieName(process.env);
    const baseUrl = requireEnv(process.env, "PDF_BASE_URL");

    return [
      {
        name: cookieName,
        value: authToken,
        url: baseUrl,
        httpOnly: true,
        sameSite: "Lax",
      },
    ];
  }
}
