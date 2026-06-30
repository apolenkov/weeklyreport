import { roleSchema } from "@customreport/shared";
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

/**
 * Dev-only authentication surface, split out of `auth.routes.ts` so the
 * production file carries nothing dev-specific. Every route here is mounted by
 * `mountDevLoginRoutes`, which `mountAuthRoutes` calls ONLY when
 * `AUTH_DEV_MODE === "true"` (and the boot fence forbids that under
 * `NODE_ENV=production`). Nothing in this module is reachable in production.
 *
 * dev-login is a UAT role switcher among SEEDED users — not a user factory:
 * it re-syncs an existing row so a `?role=` switch updates the live user.
 * Brand-new-user provisioning is the SAML path's job (auth.routes.ts).
 */

// Typed exhaustively on `Role`, so adding a role to the enum fails to compile
// here until it is given an entry — no silently-missing role.
const DEV_LOGIN_EMAIL_BY_ROLE: Record<Role, string> = {
  head: "head@customreport.local",
  lead: "lead1@customreport.local",
  admin: "admin@customreport.local",
  viewer: "viewer@customreport.local",
};

// UX-16: role-aware default landing. Must stay in sync with DEFAULT_FOR_ROLE
// in apps/web/src/app/page.tsx.
const DEV_LOGIN_REDIRECT_BY_ROLE: Record<Role, string> = {
  head: "/head/dashboard",
  lead: "/lead/report",
  admin: "/admin",
  viewer: "/reports?tab=published",
};

const DEV_LOGIN_DEFAULT_ROLE: Role = "head";
// The dev SAML-login shortcut signs in as admin (no real Keycloak locally).
const DEV_SAML_LOGIN_ROLE: Role = "admin";

/** The dependencies the dev-login handlers close over. */
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

// Build the absolute dev-login redirect URL, validating and constructing with
// the same parse (see safeRedirectPath) so a value cannot pass validation yet
// resolve to a foreign host at the sink. Falls back to fallbackPath when the
// candidate is rejected.
export function resolveDevLoginRedirectUrl(
  candidate: string | undefined,
  fallbackPath: string,
  frontendUrl: string,
): string {
  const safePath = safeRedirectPath(candidate, frontendUrl) ?? fallbackPath;
  return new URL(safePath, frontendUrl).toString();
}

/**
 * Dev-mode shortcut for GET /auth/saml/login: redirect to /auth/dev-login as
 * admin (no real Keycloak running locally), preserving a safe relative `next`.
 */
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

/**
 * Resolve the dev-login identity for a validated role to an EXISTING user.
 *
 * The email is the role's canonical seed email (or an explicit `?email=` of
 * another seeded user), and the name/samlId come straight from the DB row. An
 * unknown email returns `null` — the caller fails clearly instead of
 * fabricating a phantom user from hardcoded role defaults.
 */
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
      // Validate through the canonical role enum (single source of truth) — no
      // hand-maintained role list, and `.data` is typed `Role` (no cast).
      const parsedRole = roleSchema.safeParse(requestedRole);
      if (!parsedRole.success) {
        loginAttemptsTotal.inc({ method: "dev-login", outcome: "fail" });
        res.status(400).json({
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
        res.status(404).json({
          error: `No dev-login user found (role=${validRole}). Seed the database, or pass ?email= of an existing user.`,
        });
        return;
      }

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

      res.redirect(
        resolveDevLoginRedirectUrl(
          readQueryParam(req.query.redirect),
          DEV_LOGIN_REDIRECT_BY_ROLE[validRole],
          deps.frontendUrl,
        ),
      );
    } catch (error) {
      loginAttemptsTotal.inc({ method: "dev-login", outcome: "fail" });
      next(error);
    }
  };
}

/**
 * Mount the dev-only auth routes. Called by `mountAuthRoutes` exclusively under
 * `AUTH_DEV_MODE`. The GET /auth/saml/login dev shortcut is registered here
 * INSTEAD of the production passport handler (Express picks the first match),
 * so the two are mutually exclusive by construction.
 */
export function mountDevLoginRoutes(
  expressApp: Express,
  deps: DevLoginDeps,
): void {
  expressApp.get("/auth/saml/login", (req, res) => {
    handleDevSamlLoginRedirect(req, res, deps.frontendUrl);
  });
  expressApp.get("/auth/dev-login", createDevLoginHandler(deps));
}
