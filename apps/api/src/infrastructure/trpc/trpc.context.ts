import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { INestApplication } from '@nestjs/common';
import type { UserSession } from '@customreport/shared';

import { createAuthController } from '../../modules/auth/auth.controller.js';
import { verifyPdfExportToken } from '../../modules/pdf-export/pdf-export.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AppLogger } from '../../lib/logger.js';
import { createAuditLogger, type AuditLogger } from '../../lib/audit-logger.js';

const DEV_SESSION: UserSession = {
  userId: 'a0000000-0000-4000-8000-000000000099',
  email: 'head@customreport.local',
  name: 'Department Head',
  role: 'head',
  activeReportId: 'a0000000-0000-4000-8000-000000000001',
  activeReportSectionId: null,
};

/**
 * Phase 32-B1 (H-04): synthetic session created when an inbound cookie is
 * a valid PDF-export JWT (kind='pdf-export'). The session must satisfy
 * `userSessionSchema` (uuid userId, email, etc.) so existing middlewares
 * keep their shape contract. Read-only restrictions live on TrpcContext
 * (`isPdfExport` + `pdfReportId`) and are enforced by `pdfExportGuardMiddleware`
 * in trpc.middleware, NOT by mutating the role.
 */
const PDF_EXPORT_SYNTHETIC_USER_ID = 'a0000000-0000-4000-8000-0000000pdfwk';
const PDF_EXPORT_SYNTHETIC_EMAIL = 'pdf-worker@internal.example.test';

function buildPdfExportSession(reportId: string): UserSession {
  return {
    userId: PDF_EXPORT_SYNTHETIC_USER_ID,
    email: PDF_EXPORT_SYNTHETIC_EMAIL,
    name: 'PDF Worker',
    // viewer is the narrowest role that can read a published report via the
    // service-layer filters. The pdfExportGuard middleware further restricts
    // procedure paths to `weeklyReport.get` and `archive.detail`.
    role: 'viewer',
    activeReportId: reportId,
    activeReportSectionId: null,
  };
}

export type TrpcContext = {
  session: UserSession | null;
  logger: AppLogger;
  /**
   * AUTH-08 (Phase 29-01): structured audit channel for security-relevant
   * events (login success/fail, logout, role-denied). Built once per
   * factory; the same instance is shared across all requests because the
   * underlying AppLogger is request-agnostic (correlation IDs flow via
   * nestjs-cls).
   */
  auditLogger: AuditLogger;
  /**
   * Client-perceived IP read from `req.ip` (Express trust-proxy aware).
   * Threat-model T3: never read from raw X-Forwarded-For; this field is
   * the canonical seam audit emits read from.
   */
  ip: string;
  /**
   * Phase 32-B1 (H-04): true when the inbound cookie verified as a
   * PDF-export-scoped JWT (rather than a regular session JWT). When true,
   * the synthetic session is restricted to a hard-coded allowlist of read
   * procedures keyed on `pdfReportId`; all other procedures throw FORBIDDEN
   * via the `pdfExportGuard` middleware applied to every protected procedure
   * helper.
   */
  isPdfExport: boolean;
  /**
   * Phase 32-B1 (H-04): the reportId from the verified PDF JWT claim, used
   * by pdfExportGuard to assert the procedure input's reportId matches.
   * `null` whenever `isPdfExport === false`.
   */
  pdfReportId: string | null;
};

export function createContextFactory(_app: INestApplication, logger: AppLogger) {
  const authController = createAuthController(process.env);
  // Resolve PrismaService once (not per request) from the NestJS DI container.
  const prisma = _app.get(PrismaService);
  const auditLogger = createAuditLogger(logger);

  return async ({ req }: CreateExpressContextOptions): Promise<TrpcContext> => {
    const ip = req.ip ?? 'unknown';
    const token = req.cookies?.['customreport_session'] as string | undefined;

    if (token) {
      try {
        const session = authController.verifySessionToken(token);
        return {
          session: await resolveSectionId(session, prisma),
          logger,
          auditLogger,
          ip,
          isPdfExport: false,
          pdfReportId: null,
        };
      } catch {
        // Regular session token invalid/expired -- try the PDF-export
        // verifier path before falling through to dev-mode / null.
      }

      // Phase 32-B1 (H-04): PDF worker authentication path. The Playwright
      // browser injects a 5-min JWT signed by `signPdfExportToken` carrying
      // `{ reportId, kind: 'pdf-export' }`. We verify against
      // PDF_EXPORT_JWT_SECRET (different secret than session JWT). On
      // success we synthesize a viewer-shaped session bound to the reportId
      // claim; the `pdfExportGuard` middleware enforces the
      // procedure-allowlist + reportId-match constraint.
      try {
        const pdfClaims = verifyPdfExportToken(token);
        return {
          session: buildPdfExportSession(pdfClaims.reportId),
          logger,
          auditLogger,
          ip,
          isPdfExport: true,
          pdfReportId: pdfClaims.reportId,
        };
      } catch {
        // Not a PDF token either -- fall through to dev-mode / null.
      }
    }

    // AUTH-01 / Phase 29-04 (CC-1, CC-2):
    //  - DEV_SESSION fallback ONLY fires when NODE_ENV !== 'production' AND a
    //    dev-auth flag is set. A boot-time fence in `lib/dev-auth-fence.ts`
    //    refuses to start the API at all if either flag is true under
    //    NODE_ENV=production, so this branch is doubly defended.
    //  - AUTH_DEV_MODE=true: legacy dev-loop convenience (preserved for the
    //    docker-compose dev stack and local pnpm dev runs).
    //  - AUTH_DEV_MODE_ALLOW_TEST=true: staged path enabling the integration
    //    suite + PDF worker to operate against a "real" tRPC context without
    //    flipping production. Retired entirely once the mock IdP container
    //    follow-up lands (deferred from this plan due to no Docker network).
    const isNonProd = process.env['NODE_ENV'] !== 'production';
    const devModeEnabled = isNonProd && process.env['AUTH_DEV_MODE'] === 'true';
    const allowTest = isNonProd && process.env['AUTH_DEV_MODE_ALLOW_TEST'] === 'true';
    if (devModeEnabled || allowTest) {
      return {
        session: await resolveSectionId({ ...DEV_SESSION }, prisma),
        logger,
        auditLogger,
        ip,
        isPdfExport: false,
        pdfReportId: null,
      };
    }

    return {
      session: null,
      logger,
      auditLogger,
      ip,
      isPdfExport: false,
      pdfReportId: null,
    };
  };
}

/**
 * DEV_SESSION sets activeReportSectionId to null because it is a head user.
 * For lead users in production, the JWT will contain the sectionId.
 * This dynamic lookup serves as a fallback for any session missing the sectionId
 * (e.g. dev mode, or token issued before the section was created).
 *
 * Heads have no ReportSection of their own, so findFirst returns null and the
 * session keeps activeReportSectionId = null. That is correct -- head users
 * use the review.* endpoints which filter by reportId, not sectionId.
 */
async function resolveSectionId(
  session: UserSession,
  prisma: PrismaService,
): Promise<UserSession> {
  if (!session.activeReportSectionId && session.activeReportId && session.userId) {
    const section = await prisma.reportSection.findFirst({
      where: {
        reportId: session.activeReportId,
        authorId: session.userId,
      },
      select: { id: true },
    });
    if (section) {
      session.activeReportSectionId = section.id;
    }
  }
  return session;
}
