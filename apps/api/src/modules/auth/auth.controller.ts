import {
  SECONDS_PER_HOUR,
  type UserSession,
  userSessionSchema,
} from "@customreport/shared";
import { serialize } from "cookie";
import jwt from "jsonwebtoken";

import { requireEnv } from "../../lib/env.js";
import { resolveSessionCookieName } from "../../lib/session-cookie.js";

const ONE_HOUR_IN_SECONDS = SECONDS_PER_HOUR;

/**
 * The session token is symmetric (HS256). Pin the accepted algorithm on verify
 * so a token can never be coerced into a different algorithm, and require a
 * secret long enough not to be brute-forced offline from a captured token.
 *
 * Coordination note: `refactor-auth-exemplary-layering` deduplicates the
 * "require env var" helpers. `requireJwtSecret` MUST stay a distinct function
 * (keeping the `>= MIN_JWT_SECRET_LENGTH` check) rather than collapsing into a
 * generic presence getter, and the `{ algorithms: [SESSION_JWT_ALGORITHM] }`
 * pin below MUST survive that refactor.
 */
const SESSION_JWT_ALGORITHM = "HS256" as const;
const MIN_JWT_SECRET_LENGTH = 32;

export interface JwtSigner {
  signSession: (payload: UserSession) => string;
  verifySession: (token: string) => UserSession;
}

function requireJwtSecret(env: NodeJS.ProcessEnv): string {
  // Layered on the generic presence helper: presence first (same error message
  // as every other required var), then the symmetric-secret strength floor.
  const secret = requireEnv(env, "AUTH_JWT_SECRET");

  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `AUTH_JWT_SECRET is too short (must be >= ${MIN_JWT_SECRET_LENGTH} characters).`,
    );
  }

  return secret;
}

export function createJwtSigner(env: NodeJS.ProcessEnv): JwtSigner {
  const secret = requireJwtSecret(env);

  return {
    signSession(payload) {
      const parsedPayload = userSessionSchema.parse(payload);

      return jwt.sign(parsedPayload, secret, {
        algorithm: SESSION_JWT_ALGORITHM,
        expiresIn: ONE_HOUR_IN_SECONDS,
      });
    },
    verifySession(token) {
      const decoded = jwt.verify(token, secret, {
        algorithms: [SESSION_JWT_ALGORITHM],
      });

      return userSessionSchema.parse(decoded);
    },
  };
}

export function createSessionCookie({
  token,
  env,
  // Logout reuses this with an empty token and maxAgeSeconds 0 so the cleared
  // cookie matches the set cookie's name and attributes exactly.
  maxAgeSeconds = ONE_HOUR_IN_SECONDS,
}: {
  token: string;
  env: NodeJS.ProcessEnv;
  maxAgeSeconds?: number;
}): string {
  return serialize(resolveSessionCookieName(env), token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function createAuthController(env: NodeJS.ProcessEnv) {
  const jwtSigner = createJwtSigner(env);

  return {
    issueSessionCookie(payload: UserSession) {
      const token = jwtSigner.signSession(payload);

      return {
        token,
        setCookieHeader: createSessionCookie({ token, env }),
      };
    },
    verifySessionToken(token: string) {
      return jwtSigner.verifySession(token);
    },
  };
}
