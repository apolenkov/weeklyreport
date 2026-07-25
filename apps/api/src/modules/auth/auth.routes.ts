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

interface AuthRouteDeps {
  prisma: PrismaClient;
  authController: ReturnType<typeof createAuthController>;
  auditLogger: AuditLogger;
  provisionLeadWorkspace: ProvisionLeadWorkspace;
  frontendUrl: string;
  env: NodeJS.ProcessEnv;
}

function rejectSamlAssertion(
  deps: Pick<AuthRouteDeps, "auditLogger" | "frontendUrl">,
  req: Request,
  res: Response,
): void {
  deps.auditLogger.loginFail({
    userId: "anonymous",
    role: null,
    ip: req.ip ?? "unknown",
    reason: "invalid_assertion",
  });
  loginAttemptsTotal.inc({ method: "saml", outcome: "fail" });
  res.redirect(`${deps.frontendUrl}/auth/error?reason=invalid_assertion`);
}

/**
 * Create Saml Authentication Callback.
 * @param deps - The deps argument.
 * @param req - The req argument.
 * @param res - The res argument.
 * @param next - The next argument.
 */
export function createSamlAuthenticationCallback(
  deps: Pick<AuthRouteDeps, "auditLogger" | "frontendUrl">,
  req: Request,
  res: Response,
  next: NextFunction,
): passport.AuthenticateCallback {
  return (error, user) => {
    if (error || !user) {
      rejectSamlAssertion(deps, req, res);
      return;
    }
    req.user = user;
    next();
  };
}

function createSamlAuthenticationHandler(deps: AuthRouteDeps): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const authenticate = passport.authenticate(
      "saml",
      { session: false },
      createSamlAuthenticationCallback(deps, req, res, next),
    ) as RequestHandler;
    authenticate(req, res, next);
  };
}

function createSamlCallbackHandler(deps: AuthRouteDeps): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = req.user as SamlProfile | undefined;

      if (!profile) {
        rejectSamlAssertion(deps, req, res);
        return;
      }

      const session = await buildUserSession(
        deps.prisma,
        profile,
        deps.provisionLeadWorkspace,
      );
      const { setCookieHeader } =
        deps.authController.issueSessionCookie(session);

      deps.auditLogger.loginSuccess({
        userId: session.userId,
        role: session.role,
        ip: req.ip ?? "unknown",
      });
      loginAttemptsTotal.inc({ method: "saml", outcome: "success" });

      res.setHeader("Set-Cookie", setCookieHeader);
      res.redirect(deps.frontendUrl);
    } catch (error) {
      // Any post-passport failure (DB write, JWT signing, etc.) is still a
      // failed login from the user's perspective.
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

const HTTP_FORBIDDEN = 403;

// Normalize FRONTEND_URL(S) to bare origins; raw string compare fails on trailing slash.
/**
 * Derive Logout Origins.
 * @param frontendUrl - The frontendUrl argument.
 * @param frontendUrlsCsv - The frontendUrlsCsv argument.
 */
export function deriveLogoutOrigins(
  frontendUrl: string,
  frontendUrlsCsv: string | undefined,
): ReadonlySet<string> {
  const toOrigin = (value: string): string | null => {
    try {
      return new URL(value).origin;
    } catch {
      return null;
    }
  };
  return new Set(
    [frontendUrl, ...(frontendUrlsCsv?.split(",") ?? [])]
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map(toOrigin)
      .filter((origin): origin is string => origin !== null),
  );
}

/**
 * Create Logout Handler.
 * @param deps - The deps argument.
 */
export function createLogoutHandler(
  deps: Pick<AuthRouteDeps, "auditLogger" | "env"> & {
    allowedOrigins: ReadonlySet<string>;
  },
): RequestHandler {
  return (request: Request, res: Response) => {
    // Present Origin must be a configured frontend origin; missing Origin passes
    // (same-origin form / server-to-server), matching revalidate-org CSRF.
    const requestOrigin = request.headers.origin;
    if (
      requestOrigin !== undefined &&
      !deps.allowedOrigins.has(requestOrigin)
    ) {
      res.status(HTTP_FORBIDDEN).json({ error: "Forbidden" });
      return;
    }

    // No session → anonymous/null so SIEM sees no-session logout (not a fake role).
    const reqUser = (request as Request & { user?: UserSession }).user;
    deps.auditLogger.logout({
      userId: reqUser?.userId ?? "anonymous",
      role: reqUser?.role ?? null,
      ip: request.ip ?? "unknown",
    });

    // Reuse the cookie issuer with an empty token + maxAge 0 so the cleared
    // cookie matches the set cookie's name and attributes exactly.
    res.setHeader(
      "Set-Cookie",
      createSessionCookie({ token: "", env: deps.env, maxAgeSeconds: 0 }),
    );
    res.redirect("/");
  };
}

// Dev-login-only: callback stays mounted as 503 so misdirected assertions
// report "not configured", not 404.
/**
 * Create Saml Unavailable Handler.
 */
export function createSamlUnavailableHandler(): RequestHandler {
  const HTTP_SERVICE_UNAVAILABLE = 503;
  return (_req, res) => {
    res
      .status(HTTP_SERVICE_UNAVAILABLE)
      .json({ error: "SAML is not configured on this deployment" });
  };
}

function mountSamlRoutes(
  expressApp: Express,
  samlStrategy: SamlStrategy | undefined,
  deps: AuthRouteDeps,
): void {
  if (!samlStrategy) {
    // main.ts only omits the strategy in the dev-login-only posture; anything
    // else reaching here is a wiring bug — refuse to boot rather than serve
    // an auth surface with no way to log in.
    if (deps.env.AUTH_DEV_MODE !== "true") {
      throw new Error(
        "mountAuthRoutes: a SAML strategy is required when AUTH_DEV_MODE is off",
      );
    }
    expressApp.post("/auth/saml/callback", createSamlUnavailableHandler());
    return;
  }

  // passport @types depend on express@4, project uses express@5 — cast required
  passport.use("saml", samlStrategy as unknown as passport.Strategy);

  // GET /auth/saml/login — Express picks the first registered route. In dev the
  // dev-login module has already mounted a shortcut here INSTEAD of the
  // passport handler; outside dev mode the real SAML entrypoint is registered.
  if (deps.env.AUTH_DEV_MODE !== "true") {
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
    createSamlAuthenticationHandler(deps),
    createSamlCallbackHandler(deps),
  );
}

/**
 * Mount Auth Routes.
 * @param expressApp - The expressApp argument.
 * @param samlStrategy - The samlStrategy argument.
 * @param authController - The authController argument.
 * @param prisma - The prisma argument.
 * @param env - The env argument.
 * @param provisionLeadWorkspace - The provisionLeadWorkspace argument.
 * @param auditLogger - The auditLogger argument.
 */
export function mountAuthRoutes(
  expressApp: Express,
  samlStrategy: SamlStrategy | undefined,
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

  if (env.AUTH_DEV_MODE === "true") {
    mountDevLoginRoutes(expressApp, deps);
  }

  mountSamlRoutes(expressApp, samlStrategy, deps);

  expressApp.post(
    "/auth/logout",
    createLogoutHandler({
      ...deps,
      allowedOrigins: deriveLogoutOrigins(frontendUrl, env.FRONTEND_URLS),
    }),
  );
}
