import jwt from 'jsonwebtoken';
import {
  pdfExportJobSchema,
  type AssembledReport,
  type PdfExportJob,
} from '@customreport/shared';
import type { Queue } from 'bullmq';

import { createNullLogger, type AppLogger } from '../../lib/logger';
import { customreportPdfExportRequestsTotal } from '../../infrastructure/metrics/metrics.registry.js';

export class PdfExportDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfExportDomainError';
  }
}

export type PdfExportJobRecord = PdfExportJob & { requestedBy: string };

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
  getExportJob(jobId: string): Promise<PdfExportJobRecord | null>;
  saveExportJob(job: PdfExportJob): Promise<PdfExportJob>;
  markExportFailed(jobId: string, error: string): Promise<void>;
}

/**
 * AUTH-05 (Phase 28-02 / Phase 32-B1 H-04): claim shape carried in the 5-min
 * PDF export JWT.
 *
 * The reportId claim binds the cookie to a single resource so a leaked
 * cookie cannot be reused to render arbitrary reports. The `kind` claim
 * disambiguates this token from regular session JWTs (which use a
 * different secret and a much wider claim shape) so the tRPC context
 * verifier can route it to the correct check path.
 *
 * Phase 32-B1 (H-04) adds the server-side verifier (`verifyPdfExportToken`)
 * and wires it into `trpc.context.ts`; the synthetic session it produces
 * is restricted to a hard-coded allowlist of read procedures scoped to the
 * JWT's reportId.
 */
export interface PdfExportTokenClaims {
  reportId: string;
  kind: 'pdf-export';
}

const PDF_EXPORT_JWT_TTL = '5m';
const PDF_EXPORT_KIND = 'pdf-export' as const;

/**
 * AUTH-05 / Phase 32-B1 (H-04): verify a token signed by `signPdfExportToken`
 * against `PDF_EXPORT_JWT_SECRET`. Returns the typed claim shape on success;
 * throws if the token is invalid, expired, missing the kind claim, or signed
 * with a different secret. This is the deferred verifier called from
 * `trpc.context.ts` after `verifySessionToken` fails.
 */
export function verifyPdfExportToken(token: string): PdfExportTokenClaims {
  const secret = process.env['PDF_EXPORT_JWT_SECRET'];
  if (!secret || secret.length < 16) {
    throw new Error(
      'PDF_EXPORT_JWT_SECRET is missing or too short (must be >= 16 chars).',
    );
  }
  const decoded = jwt.verify(token, secret);
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid PDF export token payload');
  }
  const claims = decoded as Record<string, unknown>;
  if (claims['kind'] !== PDF_EXPORT_KIND) {
    throw new Error('Token is not a PDF export token (kind mismatch)');
  }
  if (typeof claims['reportId'] !== 'string' || !claims['reportId']) {
    throw new Error('PDF export token missing reportId claim');
  }
  return { reportId: claims['reportId'], kind: PDF_EXPORT_KIND };
}

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
    const claims: PdfExportTokenClaims = { reportId, kind: PDF_EXPORT_KIND };
    return jwt.sign(claims, secret, { expiresIn: PDF_EXPORT_JWT_TTL });
  }

  async requestPdfExport(
    reportId: string,
    requestedBy?: string,
    authToken?: string,
    /**
     * Phase 52-A (UFB-054): requesting role for the product-telemetry
     * `customreport_pdf_export_requests_total{role}` counter. Optional —
     * worker / cron callers default to `'system'`. The label is the
     * normalised session role string when supplied.
     */
    requestedByRole?: string,
  ): Promise<PdfExportJob> {
    const report = await this.repository.getPublishedReport(reportId);

    if (!report || report.status !== 'published') {
      throw new PdfExportDomainError('PDF export requires a published report.');
    }

    this.logger.info('requesting PDF export', { reportId, requestedBy });
    // Phase 52-A (UFB-054): bump role-labelled counter before the queue
    // enqueue. We're past the validation gate, so a successful enqueue
    // (or queue-less test scenario) maps 1:1 to a customer-facing
    // "export requested" event.
    customreportPdfExportRequestsTotal.inc({
      role: requestedByRole ?? 'system',
    });
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

  async getPdfExportStatus(
    jobId: string,
    requestedBy?: string,
  ): Promise<PdfExportJob> {
    const job = await this.repository.getExportJob(jobId);

    if (!job || (requestedBy && job.requestedBy !== requestedBy)) {
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
   *
   * Phase 32-B2 (M-01): use Playwright's `url` field instead of inferring
   * `domain` (+ `secure` from `protocol`) from `PDF_BASE_URL`. Domain
   * inference is fragile when the URL is an IP (`http://10.0.0.5:3000`),
   * `localhost`, or a behind-proxy hostname — Playwright either rejects
   * the entry or silently scopes the cookie to a different origin than
   * the page. Passing `url` is Playwright's official way to attach a
   * cookie to a specific origin regardless of host shape, and it derives
   * the secure flag from the URL's protocol automatically.
   */
  buildAuthCookies(authToken: string): Array<{
    name: string;
    value: string;
    url: string;
    httpOnly: boolean;
    sameSite: 'Lax' | 'Strict' | 'None';
  }> {
    const cookieName = process.env.AUTH_JWT_COOKIE_NAME ?? 'customreport_session';
    const baseUrl = process.env.PDF_BASE_URL ?? 'http://localhost:3000';

    return [{
      name: cookieName,
      value: authToken,
      url: baseUrl,
      httpOnly: true,
      sameSite: 'Lax',
    }];
  }
}
