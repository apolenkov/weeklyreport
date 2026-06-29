import type { UserSession } from "@customreport/shared";
import type { Strategy as SamlStrategy } from "@node-saml/passport-saml";
import type { PrismaClient } from "@prisma/client";
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
import { requireEnv } from "../../lib/env.js";
import {
  type createAuthController,
  createSessionCookie,
} from "./auth.controller.js";
import { mountDevLoginRoutes } from "./dev-login.routes.js";
import {
  buildUserSession,
  type ProvisionLeadWorkspace,
  type SamlProfile,
} from "./user-session.js";

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

export function mountAuthRoutes(
  expressApp: Express,
  samlStrategy: SamlStrategy,
  authController: ReturnType<typeof createAuthController>,
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv,
  provisionLeadWorkspace: ProvisionLeadWorkspace,
  auditLogger: AuditLogger = createNullAuditLogger(),
): void {
  // FRONTEND_URL is validated by env.schema (real URL in prod via the
  // production fence, localhost default in dev synced into process.env by
  // main.ts), so it is always present — no hardcoded localhost fallback here.
  const frontendUrl = requireEnv(env, "FRONTEND_URL");
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

  // GET /auth/saml/login — Express picks the first registered route. In dev the
  // dev-login module mounts a shortcut here INSTEAD of the passport handler;
  // outside dev mode the real SAML entrypoint is registered.
  if (env.AUTH_DEV_MODE === "true") {
    mountDevLoginRoutes(expressApp, deps);
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
}
