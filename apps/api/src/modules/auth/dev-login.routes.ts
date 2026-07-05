import { ROLE_HOME_PATH, roleSchema } from "@customreport/shared";
import type { PrismaClient, Role } from "@prisma/client";
import type {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";

import { loginAttemptsTotal } from "../../infrastructure/metrics/metrics.registry.js";
import type { createAuthController } from "./auth.controller.js";
import {
  buildUserSession,
  type ProvisionLeadWorkspace,
  type SamlProfile,
} from "./user-session.js";

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

// Dev-only auth surface, mounted only under AUTH_DEV_MODE (the boot fence
// forbids that flag under NODE_ENV=production) — nothing here reaches
// production. Its resync-vs-create-only role is fixed in auth-module-layering.

const DEV_LOGIN_EMAIL_BY_ROLE: Record<Role, string> = {
  head: "head@customreport.local",
  lead: "lead1@customreport.local",
  admin: "admin@customreport.local",
  viewer: "viewer@customreport.local",
};

const DEV_LOGIN_DEFAULT_ROLE: Role = "head";
// The dev SAML-login shortcut signs in as admin (no real Keycloak locally).
const DEV_SAML_LOGIN_ROLE: Role = "admin";

export interface DevLoginDeps {
  prisma: PrismaClient;
  authController: ReturnType<typeof createAuthController>;
  provisionLeadWorkspace: ProvisionLeadWorkspace;
  frontendUrl: string;
}

const readQueryParam = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

// Same-origin redirect validation. ONE WHATWG `new URL` parse against the app
// origin is the gate: it normalizes the `/\evil.com` backslash bypass (which
// resolves off-origin) that the old `startsWith('/') && !includes('://')` guard
// missed, and returns ONLY pathname+search+hash so a caller rebuilds the
// absolute URL from the SAME parse — closing the concatenation hole where
// `redirect=@evil.com` made `frontendUrl + value` reparse to host evil.com.
// Returns null when the value is absent, off-origin, or malformed; the leading
// `//` / `\` rejections are cheap defence-in-depth, not the primary gate.
export function safeRedirectPath(
  candidate: string | undefined,
  frontendUrl: string,
): string | null {
  if (candidate === undefined) return null;
  if (/^[\\/]{2}/.test(candidate) || candidate.startsWith("\\")) return null;
  try {
    const { origin } = new URL(frontendUrl);
    const resolved = new URL(candidate, origin);
    if (resolved.origin !== origin) return null;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}

// Validate and build from the SAME parse (see safeRedirectPath) so a value
// cannot pass the origin gate yet resolve off-origin at the sink.
export function resolveDevLoginRedirectUrl(
  candidate: string | undefined,
  fallbackPath: string,
  frontendUrl: string,
): string {
  const safePath = safeRedirectPath(candidate, frontendUrl) ?? fallbackPath;
  return new URL(safePath, frontendUrl).toString();
}

// Dev shortcut for GET /auth/saml/login (no real Keycloak locally): sign in as
// admin via /auth/dev-login, preserving only a safe relative `next`.
function handleDevSamlLoginRedirect(
  req: Request,
  res: Response,
  frontendUrl: string,
): void {
  const params = new URLSearchParams({
    role: DEV_SAML_LOGIN_ROLE,
    email: DEV_LOGIN_EMAIL_BY_ROLE[DEV_SAML_LOGIN_ROLE],
  });
  const safeNext = safeRedirectPath(
    readQueryParam(req.query.next),
    frontendUrl,
  );
  if (safeNext !== null) {
    params.set("redirect", safeNext);
  }
  res.redirect(`/auth/dev-login?${params.toString()}`);
}

// Resolves to an EXISTING seeded user (role's canonical email, or an explicit
// `?email=`); an unknown email returns null so the caller fails clearly rather
// than fabricating a phantom user from hardcoded defaults.
export async function resolveDevLoginIdentity(
  prisma: PrismaClient,
  role: Role,
  query: Request["query"],
): Promise<SamlProfile | null> {
  const email = readQueryParam(query.email) ?? DEV_LOGIN_EMAIL_BY_ROLE[role];

  const dbUser = await prisma.user.findFirst({
    where: { email },
    select: { name: true, samlId: true },
  });
  if (!dbUser) return null;

  return { email, role, displayName: dbUser.name, samlId: dbUser.samlId };
}

function createDevLoginHandler(deps: DevLoginDeps): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestedRole =
        readQueryParam(req.query.role) ?? DEV_LOGIN_DEFAULT_ROLE;
      const parsedRole = roleSchema.safeParse(requestedRole);
      if (!parsedRole.success) {
        loginAttemptsTotal.inc({ method: "dev-login", outcome: "fail" });
        res.status(HTTP_BAD_REQUEST).json({
          error: `Invalid role: ${requestedRole}. Must be one of: ${roleSchema.options.join(", ")}`,
        });
        return;
      }
      const validRole = parsedRole.data;

      const identity = await resolveDevLoginIdentity(
        deps.prisma,
        validRole,
        req.query,
      );
      if (!identity) {
        loginAttemptsTotal.inc({ method: "dev-login", outcome: "fail" });
        res.status(HTTP_NOT_FOUND).json({
          error: `No dev-login user found (role=${validRole}). Seed the database, or pass ?email= of an existing user.`,
        });
        return;
      }

      // resyncExisting: dev-login updates the live row on a ?role= switch,
      // unlike create-only SAML (auth-module-layering).
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

      res.redirect(
        resolveDevLoginRedirectUrl(
          readQueryParam(req.query.redirect),
          ROLE_HOME_PATH[validRole],
          deps.frontendUrl,
        ),
      );
    } catch (error) {
      loginAttemptsTotal.inc({ method: "dev-login", outcome: "fail" });
      next(error);
    }
  };
}

// The GET /auth/saml/login dev shortcut is registered here INSTEAD of the
// production passport handler (Express first-match), so the two are mutually
// exclusive by construction.
export function mountDevLoginRoutes(
  expressApp: Express,
  deps: DevLoginDeps,
): void {
  expressApp.get("/auth/saml/login", (req, res) => {
    handleDevSamlLoginRedirect(req, res, deps.frontendUrl);
  });
  expressApp.get("/auth/dev-login", createDevLoginHandler(deps));
}
