import jwt from 'jsonwebtoken';
import {
  pdfExportJobSchema,
  type AssembledReport,
  type PdfExportJob,
} from '@customreport/shared';
import type { Queue } from 'bullmq';

import { createNullLogger, type AppLogger } from '../../lib/logger';

export class PdfExportDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfExportDomainError';
  }
}

export interface PdfExportRepository {
  getPublishedReport(reportId: string): Promise<AssembledReport | null>;
  /**
   * Persist a queued PDF export job.
   *
   * @param job          Domain export job (Zod-parsed shape).
   * @param requestedBy  Session user id of the head who requested the export.
   *                     Optional for non-tRPC callers (workers, scripts) where
   *                     the prisma repository falls back to `'system'`.
   */
  createExportJob(job: PdfExportJob, requestedBy?: string): Promise<PdfExportJob>;
  getExportJob(jobId: string): Promise<PdfExportJob | null>;
  saveExportJob(job: PdfExportJob): Promise<PdfExportJob>;
  markExportFailed(jobId: string, error: string): Promise<void>;
}

/**
 * AUTH-05 (Phase 28-02): claim shape carried in the 5-min PDF export JWT.
 *
 * The reportId claim binds the cookie to a single resource so a leaked
 * cookie cannot be reused to render arbitrary reports. Phase 29 (AUTH-02)
 * will introduce a server-side verifier that asserts this claim against
 * the request URL; for Phase 28 we ship the issuer half only — the
 * verifier remains the existing trpc.context.ts cookie path (AUTH_DEV_MODE
 * or AUTH_DEV_MODE_ALLOW_TEST falls through to DEV_SESSION when the JWT
 * fails verification, which is the staged-migration intent).
 */
export interface PdfExportTokenClaims {
  reportId: string;
}

const PDF_EXPORT_JWT_TTL = '5m';

export class PdfExportService {
  private readonly logger: AppLogger;
  private readonly pdfQueue: Queue | null;

  constructor(
    private readonly repository: PdfExportRepository,
    logger?: AppLogger,
    pdfQueue?: Queue,
  ) {
    this.logger = logger ?? createNullLogger();
    this.pdfQueue = pdfQueue ?? null;
  }

  /**
   * AUTH-05: sign a 5-min scoped JWT with `{reportId}` claim.
   *
   * Throws `PdfExportDomainError` (mapped by tRPC error mapper to 500) if the
   * signing secret is missing or shorter than 16 chars — fail loud at request
   * time instead of silently producing a token nobody can verify.
   */
  signPdfExportToken(reportId: string): string {
    const secret = process.env['PDF_EXPORT_JWT_SECRET'];
    if (!secret || secret.length < 16) {
      throw new PdfExportDomainError(
        'PDF_EXPORT_JWT_SECRET is missing or too short (must be >= 16 chars).',
      );
    }
    const claims: PdfExportTokenClaims = { reportId };
    return jwt.sign(claims, secret, { expiresIn: PDF_EXPORT_JWT_TTL });
  }

  async requestPdfExport(
    reportId: string,
    requestedBy?: string,
    authToken?: string,
  ): Promise<PdfExportJob> {
    const report = await this.repository.getPublishedReport(reportId);

    if (!report || report.status !== 'published') {
      throw new PdfExportDomainError('PDF export requires a published report.');
    }

    this.logger.info('requesting PDF export', { reportId, requestedBy });
    const job = await this.repository.createExportJob(
      pdfExportJobSchema.parse({
        jobId: crypto.randomUUID(),
        reportId,
        status: 'queued',
        requestedAt: new Date(),
        completedAt: null,
        checksum: null,
        templateVersion: 'phase-2-pdf-v1',
        artifactUrl: null,
      }),
      requestedBy,
    );

    if (this.pdfQueue) {
      // AUTH-05: derive the auth cookie if the caller didn't pre-sign one. Most
      // callers don't — this keeps the contract a single tRPC mutation away
      // from "head clicks Export PDF". Signed lazily so test scenarios without
      // a queue (and thus without a real worker) don't require the secret.
      const cookieToken = authToken ?? this.signPdfExportToken(reportId);
      await this.pdfQueue.add(
        'generate',
        { reportId, jobId: job.jobId, authToken: cookieToken },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );
      this.logger.info('enqueued pdf-export job', {
        jobId: job.jobId,
        reportId,
      });
    }

    return job;
  }

  async getPdfExportStatus(jobId: string): Promise<PdfExportJob> {
    const job = await this.repository.getExportJob(jobId);

    if (!job) {
      throw new PdfExportDomainError(`PDF export job ${jobId} was not found.`);
    }

    return pdfExportJobSchema.parse(job);
  }

  async markExportCompleted(
    jobId: string,
    artifactUrl: string,
    checksum: string,
  ): Promise<PdfExportJob> {
    const job = await this.getPdfExportStatus(jobId);

    this.logger.info('marking PDF export completed', { jobId });
    return this.repository.saveExportJob(
      pdfExportJobSchema.parse({
        ...job,
        status: 'completed',
        completedAt: new Date(),
        artifactUrl,
        checksum,
      }),
    );
  }

  /** Called by BullMQ onFailed event handler when PDF generation fails. */
  async markExportFailed(jobId: string, error: string): Promise<void> {
    this.logger.error('PDF export job failed', { jobId, error });
    await this.repository.markExportFailed(jobId, error);
  }

  /**
   * Builds the Playwright browser cookie configuration for authenticated PDF rendering.
   * The auth cookie must be set before Playwright navigates to the print page.
   */
  buildAuthCookies(authToken: string): Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    httpOnly: boolean;
    secure: boolean;
  }> {
    const cookieName = process.env.AUTH_JWT_COOKIE_NAME ?? 'customreport_session';
    const baseUrl = process.env.PDF_BASE_URL ?? 'http://localhost:3000';
    const url = new URL(baseUrl);

    return [{
      name: cookieName,
      value: authToken,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
    }];
  }
}
