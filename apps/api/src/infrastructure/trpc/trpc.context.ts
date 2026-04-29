import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { INestApplication } from '@nestjs/common';
import type { UserSession } from '@customreport/shared';

import { createAuthController } from '../../modules/auth/auth.controller.js';
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
        };
      } catch {
        // Token invalid/expired -- fall through
      }
    }

    // AUTH-01 / Phase 28-02 (CC-1, CC-2):
    //  - AUTH_DEV_MODE=true: legacy dev-loop convenience (preserved verbatim).
    //  - AUTH_DEV_MODE_ALLOW_TEST=true: staged path enabling the integration
    //    suite + PDF worker to operate against a "real" tRPC context without
    //    flipping production. Phase 29 will retire DEV_SESSION entirely once
    //    the mock IdP container is wired.
    const devModeEnabled = process.env['AUTH_DEV_MODE'] === 'true';
    const allowTest = process.env['AUTH_DEV_MODE_ALLOW_TEST'] === 'true';
    if (devModeEnabled || allowTest) {
      return {
        session: await resolveSectionId({ ...DEV_SESSION }, prisma),
        logger,
        auditLogger,
        ip,
      };
    }

    return { session: null, logger, auditLogger, ip };
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
