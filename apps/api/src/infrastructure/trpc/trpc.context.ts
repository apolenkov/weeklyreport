import type { INestApplication } from "@nestjs/common";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import {
  AUTH_COOKIE_NAME,
  DEFAULT_REPORTING_GROUP,
  type UserSession,
} from "@weeklyreport/shared";

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
import {
  readRequestCookie,
  readRequestHeader,
} from "../../lib/request-boundary.js";
import { SessionRevocationService } from "../../modules/admin/index.js";
import { isUserAccessBarred } from "../../modules/auth/index.js";
import { createAuthController } from "../../modules/auth/index.js";
import { verifyPdfExportToken } from "../../modules/pdf-export/index.js";
import type { EnvConfig } from "../config/env.schema.js";
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

// Rebuild the requester's real session (hydrateSession) so export scope
// matches their in-app view. pdfExportGuard still enforces the allowlist.
// Null when requester is gone (fail closed).
export async function buildPdfExportSession(
  reportId: string,
  requestedBy: string,
  prisma: PrismaService,
  sessionRevocation: Pick<SessionRevocationService, "isRevoked">,
): Promise<UserSession | null> {
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
  correlationId?: string | undefined;
  // Optional in direct unit callers; real HTTP contexts always receive it.
  prisma?: PrismaService | undefined;
  // Shared across requests; AppLogger is request-agnostic (CLS correlation).
  auditLogger: AuditLogger;
  // From req.ip (trust-proxy aware) — never raw X-Forwarded-For (threat T3).
  ip: string;
  // PDF-export JWT: session restricted to pdfReportId allowlist via guard.
  isPdfExport: boolean;
  // JWT reportId claim; null when isPdfExport is false.
  pdfReportId: string | null;
  // JWT jobId claim; null when isPdfExport is false.
  pdfJobId?: string | null;
}

function readRequestId(header: unknown): string {
  if (typeof header === "string") return header;
  if (Array.isArray(header) && typeof header[0] === "string") return header[0];
  return NO_CORRELATION_ID;
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
  return {
    ...deps,
    session,
    isPdfExport: false,
    pdfReportId: null,
    pdfJobId: null,
  };
}

function pdfExportContext(
  deps: RequestScopedDeps,
  session: UserSession,
  pdfReportId: string,
  pdfJobId: string,
): TrpcContext {
  return { ...deps, session, isPdfExport: true, pdfReportId, pdfJobId };
}

// Only a token that fails PDF verification falls through. Technical access or
// hydration failures propagate; logical denial is a terminal anonymous context.
function parsePdfExportClaims(
  token: string,
  pdfExportJwtSecret: string | undefined,
): ReturnType<typeof verifyPdfExportToken> | null {
  try {
    return verifyPdfExportToken(token, pdfExportJwtSecret);
  } catch {
    return null;
  }
}

// Cookie-bearing request: real human session first, then the PDF-export JWT.
// Null means no verified identity; valid PDF claims with a denied requester
// return a terminal anonymous context so development authentication cannot win.
async function resolveTokenContext(
  token: string,
  deps: RequestScopedDeps,
  sessionDeps: Pick<
    HumanSessionDeps,
    "verifySessionToken" | "sessionRevocation"
  >,
  pdfExportJwtSecret: string | undefined,
): Promise<TrpcContext | null> {
  const humanSession = await resolveHumanSession(token, {
    ...sessionDeps,
    prisma: deps.prisma,
  });
  if (humanSession) return humanContext(deps, humanSession);

  // PDF worker: JWT signed with PDF_EXPORT_JWT_SECRET (≠ session secret).
  // Rebuilds requester session; pdfExportGuard still enforces allowlist.
  const pdfClaims = parsePdfExportClaims(token, pdfExportJwtSecret);
  if (!pdfClaims) {
    return null;
  }
  const pdfSession = await buildPdfExportSession(
    pdfClaims.reportId,
    pdfClaims.requestedBy,
    deps.prisma,
    sessionDeps.sessionRevocation,
  );
  return pdfSession
    ? pdfExportContext(deps, pdfSession, pdfClaims.reportId, pdfClaims.jobId)
    : humanContext(deps, null);
}

// Dev fallback only when non-prod AND a dev-auth flag is set.
// Boot fence (dev-auth-fence.ts) doubles this under NODE_ENV=production.
function isDevAuthEnabled(
  env: Pick<
    EnvConfig,
    "NODE_ENV" | "AUTH_DEV_MODE" | "AUTH_DEV_MODE_ALLOW_TEST"
  >,
): boolean {
  if (env.NODE_ENV === "production") return false;
  return env.AUTH_DEV_MODE || env.AUTH_DEV_MODE_ALLOW_TEST === "true";
}

export function createContextFactory(
  _app: INestApplication,
  logger: AppLogger,
  env: Pick<
    EnvConfig,
    | "NODE_ENV"
    | "AUTH_DEV_MODE"
    | "AUTH_DEV_MODE_ALLOW_TEST"
    | "AUTH_JWT_SECRET"
    | "PDF_EXPORT_JWT_SECRET"
  >,
) {
  const authController = createAuthController(env);
  // Resolve PrismaService once (not per request) from the NestJS DI container.
  const prisma = _app.get(PrismaService);
  const auditLogger = createAuditLogger(logger);
  const sessionRevocation = _app.get(SessionRevocationService);

  return async ({ req }: CreateExpressContextOptions): Promise<TrpcContext> => {
    const deps: RequestScopedDeps = {
      logger,
      correlationId: readRequestId(readRequestHeader(req, "x-request-id")),
      prisma,
      auditLogger,
      ip: req.ip ?? UNKNOWN_CLIENT_IP,
    };
    // Keep request cookie lookup aligned with the API set/clear paths.
    const token = readRequestCookie(req, AUTH_COOKIE_NAME);

    if (token) {
      const tokenContext = await resolveTokenContext(
        token,
        deps,
        {
          verifySessionToken: (value) =>
            authController.verifySessionToken(value),
          sessionRevocation,
        },
        env.PDF_EXPORT_JWT_SECRET,
      );
      if (tokenContext) return tokenContext;
    }

    if (isDevAuthEnabled(env)) {
      // Spread keeps DEV_SESSION as a caller-owned baseline (hydrate returns new).
      return humanContext(
        deps,
        await hydrateSession({ ...DEV_SESSION }, prisma),
      );
    }

    return humanContext(deps, null);
  };
}
