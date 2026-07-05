import type { UserSession } from "@customreport/shared";
import type { INestApplication } from "@nestjs/common";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

import { type AuditLogger, createAuditLogger } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { resolveSessionCookieName } from "../../lib/session-cookie.js";
import { SessionRevocationService } from "../../modules/admin/session-revocation.service.js";
import { createAuthController } from "../../modules/auth/auth.controller.js";
import { isUserAccessBarred } from "../../modules/auth/session-deactivation.js";
import { verifyPdfExportToken } from "../../modules/pdf-export/pdf-export.service.js";
import { ENV_CONFIG } from "../config/config.module.js";
import type { EnvConfig } from "../config/env.schema.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { hydrateSession } from "./trpc.session-hydration.js";

export { clearOrgCache } from "./trpc.session-hydration.js";

// D-32: DEV_SESSION must carry reportingGroupId so groupScopeFilter scopes
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
  reportingGroupName: "Software Development",
};

/**
 * Phase 32-B1 (H-04): synthetic session created when an inbound cookie is
 * a valid PDF-export JWT (kind='pdf-export'). The session must satisfy
 * `userSessionSchema` (uuid userId, email, etc.) so existing middlewares
 * keep their shape contract. Read-only restrictions live on TrpcContext
 * (`isPdfExport` + `pdfReportId`) and are enforced by `pdfExportGuardMiddleware`
 * in trpc.middleware, NOT by mutating the role.
 */
const PDF_EXPORT_SYNTHETIC_USER_ID = "a0000000-0000-4000-8000-0000000pdfwk";
const PDF_EXPORT_SYNTHETIC_EMAIL = "pdf-worker@internal.example.test";

/**
 * Legacy narrow synthetic session for PDF-export tokens that predate the
 * `requestedBy` claim. role:viewer with NO group access — this is what made
 * the exported report render EMPTY (filterSnapshotSections scopes to zero
 * sections). Kept only for back-compat with in-flight 5-min tokens issued
 * before the empty-PDF fix; new tokens always carry `requestedBy`.
 */
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

/**
 * driver-findings-followups (empty-PDF fix): build the PDF worker's render
 * session AS THE REQUESTER. The worker drives `/print/<reportId>`, whose tRPC
 * reads are group-scoped by the session; the old viewer-synthetic session had
 * no group access and rendered an empty report for every role. We instead
 * rebuild the requester's real session from their userId (carried in the
 * token) and run the same `hydrateSession` pipeline a logged-in request gets,
 * so the export is scoped exactly to the requester's in-app view: head → full
 * report, lead/viewer → their slice. The `pdfExportGuard` middleware still
 * restricts this session to the read-only allowlist bound to `pdfReportId`,
 * independent of the resolved role.
 *
 * Returns null when the requester no longer exists (fail closed → no session →
 * the auth middleware rejects). A token without `requestedBy` falls back to the
 * legacy narrow session.
 */
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
  /** Request correlation id from the x-request-id header, generated by the
   * CorrelationIdMiddleware before tRPC context construction. */
  correlationId?: string;
  /** Optional in direct unit callers; real HTTP contexts always receive it. */
  prisma?: PrismaService;
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
}

function readRequestId(header: string | string[] | undefined): string {
  if (Array.isArray(header)) return header[0] ?? "no-context";
  return header ?? "no-context";
}

export interface HumanSessionDeps {
  verifySessionToken: (token: string) => UserSession;
  sessionRevocation: Pick<SessionRevocationService, "isRevoked">;
  prisma: PrismaService;
}

/**
 * The single human-session chokepoint: the three steps that turn a session
 * cookie into a real, currently-valid user session — token verify, the Redis
 * revocation fast path, and the Prisma `isActive` check — followed by the
 * per-request hydration the rest of the app relies on (notably
 * `viewerGroupAccess`, which group-scope authz reads and which is NOT in the
 * JWT). Returns null for any invalid / revoked / deactivated token.
 *
 * Deliberately does NOT accept the PDF-export worker token or the dev-mode
 * synthetic session that the full `createContext` chain falls back to: a caller
 * that needs a real human (the authenticated `/pdfs` download) resolves through
 * this and rejects everything else. `createContext` layers those fallbacks on
 * top of this, never the reverse.
 *
 * The revoked/deactivated decision is delegated to `isUserAccessBarred`: a
 * Redis revocation fast path that fails OPEN, then an authoritative Prisma
 * `isActive` read that fails CLOSED — including a missing user row (a
 * hard-deleted account no longer keeps a live session).
 */
export async function resolveHumanSession(
  token: string,
  deps: HumanSessionDeps,
): Promise<UserSession | null> {
  try {
    const session = deps.verifySessionToken(token);
    if (
      await isUserAccessBarred(
        session.userId,
        deps.prisma,
        deps.sessionRevocation,
      )
    ) {
      return null;
    }
    return await hydrateSession(session, deps.prisma);
  } catch {
    return null;
  }
}

export function createContextFactory(
  _app: INestApplication,
  logger: AppLogger,
) {
  const authController = createAuthController(process.env);
  // Resolve PrismaService once (not per request) from the NestJS DI container.
  const prisma = _app.get(PrismaService);
  const auditLogger = createAuditLogger(logger);
  // A2 (UAT-v7 2026-05-12): Redis-backed session revocation fast path.
  // Constructed once; the underlying ioredis client uses lazyConnect so it
  // does not block startup when Redis is unavailable.
  const sessionRevocation = new SessionRevocationService(
    undefined,
    _app.get<EnvConfig>(ENV_CONFIG),
  );

  return async ({ req }: CreateExpressContextOptions): Promise<TrpcContext> => {
    const ip = req.ip ?? "unknown";
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- synthetic/test contexts can omit req.headers despite the Express type
    const correlationId = readRequestId(req.headers?.["x-request-id"]);
    // refactor-auth-exemplary-layering: read the cookie under the SAME resolved
    // name the set/clear paths use. Previously this read a hardcoded
    // "customreport_session" while the writer honoured AUTH_JWT_COOKIE_NAME — a
    // latent mismatch for any non-default cookie name (a no-op for every real
    // config, which leaves the name at the default).
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- req.cookies is populated by cookie-parser at runtime; the optional chain guards the unmounted-middleware case
    const token = req.cookies?.[resolveSessionCookieName(process.env)] as
      | string
      | undefined;

    if (token) {
      // The human-session steps (verify + revocation fast path + isActive +
      // hydrate) live in the shared `resolveHumanSession` chokepoint; null means
      // the cookie is not a valid, current human session, so fall through to the
      // PDF-worker token path and then dev-mode / null.
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

      // Phase 32-B1 (H-04) + empty-PDF fix: PDF worker authentication path.
      // The Playwright browser injects a 5-min JWT signed by
      // `signPdfExportToken` carrying `{ reportId, kind: 'pdf-export',
      // requestedBy }`. We verify against PDF_EXPORT_JWT_SECRET (different
      // secret than session JWT). On success we rebuild the REQUESTER's session
      // (so the export is scoped to their in-app view, not an empty viewer);
      // the `pdfExportGuard` middleware still enforces the procedure-allowlist
      // + reportId-match constraint regardless of the resolved role.
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
        // Requester no longer exists → fail closed (fall through to null).
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
    const isNonProd = process.env.NODE_ENV !== "production";
    const devModeEnabled = isNonProd && process.env.AUTH_DEV_MODE === "true";
    const allowTest =
      isNonProd && process.env.AUTH_DEV_MODE_ALLOW_TEST === "true";
    if (devModeEnabled || allowTest) {
      // { ...DEV_SESSION } spread is AT THE CALL SITE intentionally (D4):
      // the four helpers mutate the session object in place; passing the
      // module-level constant directly would pollute it across requests.
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

/**
 * DEV_SESSION sets activeReportSectionId to null because it is a head user.
 * For lead users in production, the JWT will contain the sectionId.
 * This dynamic lookup serves as a fallback for any session missing the sectionId
 * (e.g. dev mode, or token issued before the section was created).
 *
 * Heads have no ReportSection of their own, so findFirst returns null and the
 * session keeps activeReportSectionId = null. That is correct -- head users
 * use the review.* endpoints which filter by reportId, not sectionId.
 *
 * The hydration pipeline itself (viewer group access, reporting-group name,
 * organization identity, section-id resolution) lives in
 * `trpc.session-hydration.ts` — imported above as `hydrateSession`.
 */
