import type { UserSession } from "@customreport/shared";
import type { INestApplication } from "@nestjs/common";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

import { type AuditLogger, createAuditLogger } from "../../lib/audit-logger.js";
import { resolveHumanSession } from "../../lib/human-session.js";
import type { AppLogger } from "../../lib/logger.js";
import { resolveSessionCookieName } from "../../lib/session-cookie.js";
import { SessionRevocationService } from "../../modules/admin/index.js";
import { isUserAccessBarred } from "../../modules/auth/index.js";
import { createAuthController } from "../../modules/auth/index.js";
import { verifyPdfExportToken } from "../../modules/pdf-export/index.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { hydrateSession } from "./trpc.session-hydration.js";

export {
  type HumanSessionDeps,
  resolveHumanSession,
} from "../../lib/human-session.js";
export { clearOrgCache } from "./trpc.session-hydration.js";

// DEV_SESSION must carry reportingGroupId so groupScopeFilter scopes
// the activity panel to the head's group in dev / integration mode.
// UUID matches DEFAULT_REPORTING_GROUP_ID in prisma/seed-constants.ts.
const DEV_SESSION: UserSession = {
  userId: "a0000000-0000-4000-8000-000000000099",
  email: "head@customreport.local",
  name: "Антон К.",
  role: "head",
  activeReportId: "a0000000-0000-4000-8000-000000000001",
  activeReportSectionId: null,
  reportingGroupId: "a0000000-0000-4000-8000-000000000301",
  reportingGroupName: "Core Development",
};

// Synthetic session for PDF-export JWTs; must satisfy userSessionSchema.
// Read-only limits live on isPdfExport/pdfReportId, not the role.
const PDF_EXPORT_SYNTHETIC_USER_ID = "a0000000-0000-4000-8000-00000000fdb0";
const PDF_EXPORT_SYNTHETIC_EMAIL = "pdf-worker@internal.customreport.local";

// Back-compat for tokens without requestedBy: viewer with no group access
// (renders empty). New tokens always carry requestedBy.
function buildLegacyPdfExportSession(reportId: string): UserSession {
  return {
    userId: PDF_EXPORT_SYNTHETIC_USER_ID,
    email: PDF_EXPORT_SYNTHETIC_EMAIL,
    name: "PDF Worker",
    role: "viewer",
    activeReportId: reportId,
    activeReportSectionId: null,
  };
}

// Rebuild the requester's real session (hydrateSession) so export scope
// matches their in-app view. pdfExportGuard still enforces the allowlist.
// Null when requester is gone (fail closed); no requestedBy → legacy session.
export async function buildPdfExportSession(
  reportId: string,
  requestedBy: string | undefined,
  prisma: PrismaService,
  sessionRevocation: Pick<SessionRevocationService, "isRevoked">,
): Promise<UserSession | null> {
  if (!requestedBy) return buildLegacyPdfExportSession(reportId);

  // A deactivated/revoked requester must not keep exporting for the token's
  // ~5-min window; fall through to no session so the auth middleware rejects.
  if (await isUserAccessBarred(requestedBy, prisma, sessionRevocation)) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: requestedBy },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      reportingGroupId: true,
    },
  });
  if (!user) return null;

  const base: UserSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    // Bind to the published report being exported; scope is driven by role +
    // group access (hydrated below), not by this field.
    activeReportId: reportId,
    activeReportSectionId: null,
    ...(user.reportingGroupId
      ? { reportingGroupId: user.reportingGroupId }
      : {}),
  };
  return hydrateSession(base, prisma);
}

export interface TrpcContext {
  session: UserSession | null;
  logger: AppLogger;
  // Set by CorrelationIdMiddleware before tRPC context construction.
  correlationId?: string;
  // Optional in direct unit callers; real HTTP contexts always receive it.
  prisma?: PrismaService;
  // Shared across requests; AppLogger is request-agnostic (CLS correlation).
  auditLogger: AuditLogger;
  // From req.ip (trust-proxy aware) — never raw X-Forwarded-For (threat T3).
  ip: string;
  // PDF-export JWT: session restricted to pdfReportId allowlist via guard.
  isPdfExport: boolean;
  // JWT reportId claim; null when isPdfExport is false.
  pdfReportId: string | null;
}

// Sentinel when the request has no correlation-id header (or empty array).
const NO_CORRELATION_ID = "no-context";
// Sentinel when Express cannot determine client IP (no socket / trust proxy).
const UNKNOWN_CLIENT_IP = "unknown";

function readRequestId(header: string | string[] | undefined): string {
  if (Array.isArray(header)) return header[0] ?? NO_CORRELATION_ID;
  return header ?? NO_CORRELATION_ID;
}

export function createContextFactory(
  _app: INestApplication,
  logger: AppLogger,
) {
  const authController = createAuthController(process.env);
  // Resolve PrismaService once (not per request) from the NestJS DI container.
  const prisma = _app.get(PrismaService);
  const auditLogger = createAuditLogger(logger);
  const sessionRevocation = _app.get(SessionRevocationService);

  return async ({ req }: CreateExpressContextOptions): Promise<TrpcContext> => {
    const ip = req.ip ?? UNKNOWN_CLIENT_IP;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- synthetic/test contexts can omit req.headers despite the Express type
    const correlationId = readRequestId(req.headers?.["x-request-id"]);
    // Same resolved name as set/clear paths (AUTH_JWT_COOKIE_NAME aware).
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- req.cookies is populated by cookie-parser at runtime; the optional chain guards the unmounted-middleware case
    const token = req.cookies?.[resolveSessionCookieName(process.env)] as
      string | undefined;

    if (token) {
      // Shared human-session chokepoint; null → fall through to PDF / dev / null.
      const humanSession = await resolveHumanSession(token, {
        verifySessionToken: (value) => authController.verifySessionToken(value),
        sessionRevocation,
        prisma,
      });
      if (humanSession) {
        return {
          session: humanSession,
          logger,
          correlationId,
          prisma,
          auditLogger,
          ip,
          isPdfExport: false,
          pdfReportId: null,
        };
      }

      // PDF worker: JWT signed with PDF_EXPORT_JWT_SECRET (≠ session secret).
      // Rebuilds requester session; pdfExportGuard still enforces allowlist.
      try {
        const pdfClaims = verifyPdfExportToken(token);
        const pdfSession = await buildPdfExportSession(
          pdfClaims.reportId,
          pdfClaims.requestedBy,
          prisma,
          sessionRevocation,
        );
        if (pdfSession) {
          return {
            session: pdfSession,
            logger,
            correlationId,
            prisma,
            auditLogger,
            ip,
            isPdfExport: true,
            pdfReportId: pdfClaims.reportId,
          };
        }
      } catch {
        // Not a PDF token either — fall through to dev-mode / null.
      }
    }

    // Dev fallback only when non-prod AND a dev-auth flag is set.
    // Boot fence (dev-auth-fence.ts) doubles this under NODE_ENV=production.
    const isNonProd = process.env.NODE_ENV !== "production";
    const devModeEnabled = isNonProd && process.env.AUTH_DEV_MODE === "true";
    const allowTest =
      isNonProd && process.env.AUTH_DEV_MODE_ALLOW_TEST === "true";
    if (devModeEnabled || allowTest) {
      // Spread keeps DEV_SESSION as a caller-owned baseline (hydrate returns new).
      const devWithOrg = await hydrateSession({ ...DEV_SESSION }, prisma);
      return {
        session: devWithOrg,
        logger,
        correlationId,
        prisma,
        auditLogger,
        ip,
        isPdfExport: false,
        pdfReportId: null,
      };
    }

    return {
      session: null,
      logger,
      correlationId,
      prisma,
      auditLogger,
      ip,
      isPdfExport: false,
      pdfReportId: null,
    };
  };
}
