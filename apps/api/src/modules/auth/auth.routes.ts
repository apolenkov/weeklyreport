import type { UserSession } from "@customreport/shared";
import type { Strategy as SamlStrategy } from "@node-saml/passport-saml";
import type { PrismaClient, Role } from "@prisma/client";
import type {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import express from "express";
import passport from "passport";

import { loginAttemptsTotal } from "../../infrastructure/metrics/metrics.registry.js";
import {
  type AuditLogger,
  createNullAuditLogger,
} from "../../lib/audit-logger.js";
import {
  type createAuthController,
  createSessionCookie,
} from "./auth.controller.js";

export interface SamlProfile {
  samlId: string;
  email: string;
  displayName: string;
  role: Role;
}

/**
 * refactor-auth-exemplary-layering: the seam through which `buildUserSession`
 * provisions a lead's workspace at login. The auth module owns authentication,
 * not report-period or report-section persistence — so it delegates both to
 * injected functions wired in the composition root (`main.ts`): the period
 * factory (`period/period-factory.ts`) finds-or-creates the current period, and
 * `report-sections/ensure-lead-section.ts` materialises the lead's section.
 */
export type ProvisionLeadWorkspace = (
  userId: string,
) => Promise<{ reportId: string; sectionId: string }>;

const DEFAULT_REPORTING_GROUP_ID = "a0000000-0000-4000-8000-000000000301";

// SAML stubs carry only `name` (= displayName); the structured ФИО parts are
// required columns the IdP cannot supply. Per the resolved decision we do NOT
// guess the name order: the whole displayName becomes `lastName`, and
// `firstName` is a whitespace placeholder — it satisfies the non-empty column
// while the name helpers treat it as absent (short form shows just the surname,
// avatar shows its initial). The admin sets the real parts on edit; canSave
// trims, so the placeholder can never be re-saved.
const SAML_STUB_FIRST_NAME_PLACEHOLDER = " ";

/**
 * Write (create or re-sync) a provisioned user. Only reached for a brand-new
 * user or a dev-login resync — the SAML create-only path reuses the existing
 * row untouched, so the reporting-group fallback machinery here never mutates
 * an existing admin-authored record.
 */
async function writeProvisionedUser(
  prisma: PrismaClient,
  profile: SamlProfile,
  existing: { id: string; reportingGroupId: string | null } | null,
) {
  const needsOwningGroup =
    profile.role !== "viewer" && !existing?.reportingGroupId;
  const fallbackReportingGroup = needsOwningGroup
    ? ((await prisma.reportingGroup.findFirst({
        where: { archived: false },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })) ??
      (await prisma.reportingGroup.upsert({
        where: { id: DEFAULT_REPORTING_GROUP_ID },
        create: {
          id: DEFAULT_REPORTING_GROUP_ID,
          name: "Core Development",
          description: "Default reporting group for newly provisioned users",
          archived: false,
        },
        update: { archived: false },
        select: { id: true },
      })))
    : null;
  const nextReportingGroupId =
    profile.role === "viewer"
      ? null
      : (existing?.reportingGroupId ??
        fallbackReportingGroup?.id ??
        DEFAULT_REPORTING_GROUP_ID);

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        samlId: profile.samlId,
        name: profile.displayName,
        role: profile.role,
        reportingGroupId: nextReportingGroupId,
      },
    });
  }

  return prisma.user.create({
    data: {
      samlId: profile.samlId,
      email: profile.email,
      name: profile.displayName,
      lastName: profile.displayName.trim() || profile.email,
      firstName: SAML_STUB_FIRST_NAME_PLACEHOLDER,
      middleName: null,
      position: null,
      role: profile.role,
      reportingGroupId: nextReportingGroupId,
    },
  });
}

export async function buildUserSession(
  prisma: PrismaClient,
  profile: SamlProfile,
  provisionLeadWorkspace: ProvisionLeadWorkspace,
  options: { resyncExisting?: boolean } = {},
): Promise<UserSession> {
  // Prefer email match (seed users may not have samlId), fall back to samlId
  const existing =
    (await prisma.user.findFirst({ where: { email: profile.email } })) ??
    (await prisma.user.findFirst({ where: { samlId: profile.samlId } }));

  // SAML is create-only: an existing record is the source of truth and is
  // NEVER re-synced from the IdP. dev-login passes { resyncExisting: true } so
  // its query-param role switch still updates the live row (the UAT mechanism).
  const user =
    existing && options.resyncExisting !== true
      ? existing
      : await writeProvisionedUser(prisma, profile, existing);

  const reportingGroup = user.reportingGroupId
    ? await prisma.reportingGroup.findUnique({
        where: { id: user.reportingGroupId },
        select: { name: true },
      })
    : null;

  // Lead users: find or auto-create their section in the active (draft) report.
  const existingSection = await prisma.reportSection.findFirst({
    where: { authorId: user.id, report: { status: "draft" } },
    select: { id: true, reportId: true },
  });

  // A lead with no active section gets their workspace provisioned (period +
  // section) through the injected seam — the auth module does not own that
  // persistence. Other roles never auto-create a section.
  const provisioned =
    !existingSection && user.role === "lead"
      ? await provisionLeadWorkspace(user.id)
      : null;

  const activeSection =
    existingSection ??
    (provisioned
      ? { id: provisioned.sectionId, reportId: provisioned.reportId }
      : null);

  // All roles: find the active report (head/viewer have no section but need the reportId)
  const activeReport = activeSection
    ? null
    : await prisma.report.findFirst({
        where: { status: "draft" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    // Structured ФИО parts plumbed into the session so the nav avatar can
    // render correct surname+given initials (falls back to `name` when null).
    lastName: user.lastName,
    firstName: user.firstName,
    middleName: user.middleName,
    role: user.role,
    activeReportId: activeSection?.reportId ?? activeReport?.id ?? null,
    activeReportSectionId: activeSection?.id ?? null,
    // UFB-040 / Phase 46-01: carry the user's owning ReportingGroup id in
    // the JWT so groupScopeFilter does not need a Prisma lookup per request.
    // viewer sessions may have no owning group; their visibility hydrates
    // through `viewerGroupAccess` lazily in trpc.context.
    reportingGroupId: user.reportingGroupId ?? undefined,
    reportingGroupName: reportingGroup?.name ?? undefined,
  };
}

// --- Dev-login role dictionaries (dev mode only) ---------------------------
// Typed exhaustively on `Role`, so adding a role to the enum fails to compile
// here until it is given an entry — no silently-missing role.

const DEV_LOGIN_EMAIL_BY_ROLE: Record<Role, string> = {
  head: "head@customreport.local",
  lead: "lead1@customreport.local",
  admin: "admin@customreport.local",
  viewer: "viewer@customreport.local",
};

// Fallback names — only used when there is no DB record for the email (fresh
// dev DB before seed has run). When a row exists, the seeded name is used so
// the session reflects the database.
const DEV_LOGIN_NAME_BY_ROLE: Record<Role, string> = {
  head: "Антон К.",
  lead: "Lead 1",
  admin: "Михаил Б.",
  viewer: "Дарья В.",
};

const DEV_LOGIN_SAML_ID_BY_ROLE: Record<Role, string> = {
  head: "head-1",
  lead: "lead-1",
  admin: "admin-1",
  viewer: "viewer-1",
};

// UX-16: role-aware default landing. Must stay in sync with DEFAULT_FOR_ROLE
// in apps/web/src/app/page.tsx.
const DEV_LOGIN_REDIRECT_BY_ROLE: Record<Role, string> = {
  head: "/head/dashboard",
  lead: "/lead/report",
  admin: "/admin",
  viewer: "/reports?tab=published",
};

const VALID_ROLES: readonly Role[] = ["lead", "head", "admin", "viewer"];
const DEV_LOGIN_DEFAULT_ROLE: Role = "head";
// The dev SAML-login shortcut signs in as admin (no real Keycloak locally).
const DEV_SAML_LOGIN_ROLE: Role = "admin";

const DEFAULT_FRONTEND_URL = "http://localhost:3000";

// --- Route handlers --------------------------------------------------------
// The dependencies each /auth/* handler closes over. `mountAuthRoutes` builds
// this once and the handler factories below capture it, so the registration
// function stays a thin wiring map.

interface AuthRouteDeps {
  prisma: PrismaClient;
  authController: ReturnType<typeof createAuthController>;
  auditLogger: AuditLogger;
  provisionLeadWorkspace: ProvisionLeadWorkspace;
  frontendUrl: string;
  env: NodeJS.ProcessEnv;
}

const readQueryParam = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * Dev-mode shortcut for GET /auth/saml/login: redirect to /auth/dev-login as
 * admin (no real Keycloak running locally), preserving a safe relative `next`.
 */
function handleDevSamlLoginRedirect(req: Request, res: Response): void {
  const params = new URLSearchParams({
    role: DEV_SAML_LOGIN_ROLE,
    email: DEV_LOGIN_EMAIL_BY_ROLE[DEV_SAML_LOGIN_ROLE],
  });
  const next = readQueryParam(req.query.next);
  if (next && next.startsWith("/") && !next.includes("://")) {
    params.set("redirect", next);
  }
  res.redirect(`/auth/dev-login?${params.toString()}`);
}

function createSamlCallbackHandler(deps: AuthRouteDeps): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = req.user as SamlProfile | undefined;

      if (!profile) {
        // AUTH-08: SAML callback hit without a passport-attached profile —
        // treat as login-fail (T2 mitigation: emit even when role/userId are
        // unknown so the audit trail captures the attempt).
        deps.auditLogger.loginFail({
          userId: "anonymous",
          role: null,
          ip: req.ip ?? "unknown",
          reason: "invalid_assertion",
        });
        loginAttemptsTotal.inc({ method: "saml", outcome: "fail" });
        res.redirect(`${deps.frontendUrl}/auth/error?reason=invalid_assertion`);
        return;
      }

      const session = await buildUserSession(
        deps.prisma,
        profile,
        deps.provisionLeadWorkspace,
      );
      const { setCookieHeader } =
        deps.authController.issueSessionCookie(session);

      // AUTH-08: structured login-success audit event.
      deps.auditLogger.loginSuccess({
        userId: session.userId,
        role: session.role,
        ip: req.ip ?? "unknown",
      });
      loginAttemptsTotal.inc({ method: "saml", outcome: "success" });

      res.setHeader("Set-Cookie", setCookieHeader);
      res.redirect(deps.frontendUrl);
    } catch (error) {
      // AUTH-08: any post-passport failure (DB write, JWT signing, etc.) is
      // still a failed login from the user's perspective.
      deps.auditLogger.loginFail({
        userId: "anonymous",
        role: null,
        ip: req.ip ?? "unknown",
        reason: error instanceof Error ? error.message : "callback-error",
      });
      loginAttemptsTotal.inc({ method: "saml", outcome: "fail" });
      next(error);
    }
  };
}

function createLogoutHandler(
  deps: Pick<AuthRouteDeps, "auditLogger" | "env">,
): RequestHandler {
  return (request: Request, res: Response) => {
    // AUTH-08: emit logout audit event using whatever session shape was
    // attached upstream (passport-strategy or proxy middleware). When no
    // session is present, fall back to userId='anonymous' / role=null —
    // Phase 32-M8 (M-08) replaced the previous 'unknown' literal so SIEM rules
    // tuned to the Role enum (or to null = "no session") see the anonymous
    // logout case explicitly rather than as a fake "unknown role" entry.
    const reqUser = (request as Request & { user?: UserSession }).user;
    deps.auditLogger.logout({
      userId: reqUser?.userId ?? "anonymous",
      role: reqUser?.role ?? null,
      ip: request.ip ?? "unknown",
    });

    // Reuse the cookie issuer with an empty token + maxAge 0 so the cleared
    // cookie matches the set cookie's name and attributes exactly.
    res.setHeader("Set-Cookie", createSessionCookie("", deps.env, 0));
    res.redirect("/");
  };
}

/**
 * Resolve the dev-login identity for a validated role from the query plus the
 * live DB row (re-seeds / schema name updates propagate without a code change).
 */
async function resolveDevLoginIdentity(
  prisma: PrismaClient,
  role: Role,
  query: Request["query"],
): Promise<SamlProfile> {
  const defaultEmail = DEV_LOGIN_EMAIL_BY_ROLE[role];
  const requestedEmail = readQueryParam(query.email);
  const email = requestedEmail ?? defaultEmail;
  const isCustomEmail =
    requestedEmail !== undefined && requestedEmail !== defaultEmail;

  const dbUser = await prisma.user.findFirst({
    where: { email },
    select: { name: true, samlId: true },
  });

  const samlId =
    dbUser?.samlId ??
    (isCustomEmail ? `dev-${email}` : DEV_LOGIN_SAML_ID_BY_ROLE[role]);
  const displayName = dbUser?.name ?? DEV_LOGIN_NAME_BY_ROLE[role];

  return { samlId, email, displayName, role };
}

function createDevLoginHandler(deps: AuthRouteDeps): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = readQueryParam(req.query.role) ?? DEV_LOGIN_DEFAULT_ROLE;
      if (!VALID_ROLES.includes(role as Role)) {
        loginAttemptsTotal.inc({ method: "dev-login", outcome: "fail" });
        res.status(400).json({
          error: `Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(", ")}`,
        });
        return;
      }
      const validRole = role as Role;

      const identity = await resolveDevLoginIdentity(
        deps.prisma,
        validRole,
        req.query,
      );

      // dev-login is the UAT role switcher: re-sync an existing row so a
      // ?role= switch updates the live user (unlike SAML, which is create-only
      // and never overwrites an existing record).
      const session = await buildUserSession(
        deps.prisma,
        identity,
        deps.provisionLeadWorkspace,
        { resyncExisting: true },
      );

      const { setCookieHeader } =
        deps.authController.issueSessionCookie(session);
      res.setHeader("Set-Cookie", setCookieHeader);
      loginAttemptsTotal.inc({ method: "dev-login", outcome: "success" });

      const redirectPath =
        readQueryParam(req.query.redirect) ??
        DEV_LOGIN_REDIRECT_BY_ROLE[validRole];
      res.redirect(`${deps.frontendUrl}${redirectPath}`);
    } catch (error) {
      loginAttemptsTotal.inc({ method: "dev-login", outcome: "fail" });
      next(error);
    }
  };
}

export function mountAuthRoutes(
  expressApp: Express,
  samlStrategy: SamlStrategy,
  authController: ReturnType<typeof createAuthController>,
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv,
  provisionLeadWorkspace: ProvisionLeadWorkspace,
  auditLogger: AuditLogger = createNullAuditLogger(),
): void {
  const frontendUrl = env.FRONTEND_URL ?? DEFAULT_FRONTEND_URL;
  const deps: AuthRouteDeps = {
    prisma,
    authController,
    auditLogger,
    provisionLeadWorkspace,
    frontendUrl,
    env,
  };

  // passport @types depend on express@4, project uses express@5 — cast required
  passport.use("saml", samlStrategy as unknown as passport.Strategy);

  // GET /auth/saml/login — Express picks the first registered route, so the dev
  // shortcut must be mounted INSTEAD of the passport handler, never both.
  if (env.AUTH_DEV_MODE === "true") {
    expressApp.get("/auth/saml/login", handleDevSamlLoginRedirect);
  } else {
    expressApp.get(
      "/auth/saml/login",
      passport.initialize(),
      // @types/passport types authenticate() as `any`; it is a RequestHandler.
      passport.authenticate("saml", { session: false }) as RequestHandler,
    );
  }

  expressApp.post(
    "/auth/saml/callback",
    express.urlencoded({ extended: false }),
    passport.initialize(),
    passport.authenticate("saml", {
      session: false,
      failureRedirect: `${frontendUrl}/auth/error?reason=invalid_assertion`,
    }) as RequestHandler,
    createSamlCallbackHandler(deps),
  );

  expressApp.post("/auth/logout", createLogoutHandler(deps));

  if (env.AUTH_DEV_MODE === "true") {
    expressApp.get("/auth/dev-login", createDevLoginHandler(deps));
  }
}
