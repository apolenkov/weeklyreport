import {
  DEFAULT_REPORTING_GROUP,
  type UserSession,
} from "@customreport/shared";
import type { INestApplication } from "@nestjs/common";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

import {
  NO_CORRELATION_ID,
  UNKNOWN_CLIENT_IP,
} from "../../lib/actor-sentinels.js";
import { type AuditLogger, createAuditLogger } from "../../lib/audit-logger.js";
import {
  type HumanSessionDeps,
  resolveHumanSession,
} from "../../lib/human-session.js";
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
const DEV_SESSION: UserSession = {
  userId: "a0000000-0000-4000-8000-000000000099",
  email: "head@customreport.local",
  name: "Антон К.",
  role: "head",
  activeReportId: "a0000000-0000-4000-8000-000000000001",
  activeReportSectionId: null,
  reportingGroupId: DEFAULT_REPORTING_GROUP.id,
  reportingGroupName: DEFAULT_REPORTING_GROUP.name,
};

// Synthetic session for PDF-export JWTs; must satisfy userSessionSchema.
// Read-only limits live on isPdfExport/pdfReportId, not the role.
const PDF_EXPORT_SYNTHETIC_USER_ID = "a0000000-0000-4000-8000-00000000fdb0";
const PDF_EXPORT_SYNTHETIC_EMAIL = "pdf-worker@internal.example.test";

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

function readRequestId(header: string | string[] | undefined): string {
  if (Array.isArray(header)) return header[0] ?? NO_CORRELATION_ID;
  return header ?? NO_CORRELATION_ID;
}

// Everything a context needs that is independent of which session wins.
type RequestScopedDeps = Pick<
  TrpcContext,
  "logger" | "correlationId" | "auditLogger" | "ip"
> & { prisma: PrismaService };

function humanContext(
  deps: RequestScopedDeps,
  session: UserSession | null,
): TrpcContext {
  return { ...deps, session, isPdfExport: false, pdfReportId: null };
}

function pdfExportContext(
  deps: RequestScopedDeps,
  session: UserSession,
  pdfReportId: string,
): TrpcContext {
  return { ...deps, session, isPdfExport: true, pdfReportId };
}

// Cookie-bearing request: real human session first, then the PDF-export JWT.
// Null means "this token proves nothing" — caller falls through to dev / anon.
async function resolveTokenContext(
  token: string,
  deps: RequestScopedDeps,
  sessionDeps: Pick<
    HumanSessionDeps,
    "verifySessionToken" | "sessionRevocation"
  >,
): Promise<TrpcContext | null> {
  const humanSession = await resolveHumanSession(token, {
    ...sessionDeps,
    prisma: deps.prisma,
  });
  if (humanSession) return humanContext(deps, humanSession);

  // PDF worker: JWT signed with PDF_EXPORT_JWT_SECRET (≠ session secret).
  // Rebuilds requester session; pdfExportGuard still enforces allowlist.
  try {
    const pdfClaims = verifyPdfExportToken(token);
    const pdfSession = await buildPdfExportSession(
      pdfClaims.reportId,
      pdfClaims.requestedBy,
      deps.prisma,
      sessionDeps.sessionRevocation,
    );
    return pdfSession
      ? pdfExportContext(deps, pdfSession, pdfClaims.reportId)
      : null;
  } catch {
    // Not a PDF token either — fall through to dev-mode / null.
    return null;
  }
}

// Dev fallback only when non-prod AND a dev-auth flag is set.
// Boot fence (dev-auth-fence.ts) doubles this under NODE_ENV=production.
function isDevAuthEnabled(env: NodeJS.ProcessEnv): boolean {
  if (env.NODE_ENV === "production") return false;
  return (
    env.AUTH_DEV_MODE === "true" || env.AUTH_DEV_MODE_ALLOW_TEST === "true"
  );
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
    const deps: RequestScopedDeps = {
      logger,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- synthetic/test contexts can omit req.headers despite the Express type
      correlationId: readRequestId(req.headers?.["x-request-id"]),
      prisma,
      auditLogger,
      ip: req.ip ?? UNKNOWN_CLIENT_IP,
    };
    // Same resolved name as set/clear paths (AUTH_JWT_COOKIE_NAME aware).
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- req.cookies is populated by cookie-parser at runtime; the optional chain guards the unmounted-middleware case
    const token = req.cookies?.[resolveSessionCookieName(process.env)] as
      string | undefined;

    if (token) {
      const tokenContext = await resolveTokenContext(token, deps, {
        verifySessionToken: (value) => authController.verifySessionToken(value),
        sessionRevocation,
      });
      if (tokenContext) return tokenContext;
    }

    if (isDevAuthEnabled(process.env)) {
      // Spread keeps DEV_SESSION as a caller-owned baseline (hydrate returns new).
      return humanContext(
        deps,
        await hydrateSession({ ...DEV_SESSION }, prisma),
      );
    }

    return humanContext(deps, null);
  };
}
