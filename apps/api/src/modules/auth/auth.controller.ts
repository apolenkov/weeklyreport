import {
  AUTH_COOKIE_NAME,
  SECONDS_PER_HOUR,
  type UserSession,
  userSessionSchema,
} from "@weeklyreport/shared";
import { stringifySetCookie } from "cookie";
import jwt from "jsonwebtoken";

import { requireEnv } from "../../lib/env.js";
import {
  isStrongJwtSecret,
  MIN_JWT_SECRET_LENGTH,
} from "../../lib/jwt-secret.js";

const ONE_HOUR_IN_SECONDS = SECONDS_PER_HOUR;

// HS256 pinned on verify + a 32-char meaningful secret floor — required by
// jwt-session-integrity (an unpinned alg or a short secret is forgeable).
const SESSION_JWT_ALGORITHM = "HS256" as const;

export interface JwtSigner {
  signSession: (payload: UserSession) => string;
  verifySession: (token: string) => UserSession;
}

function requireJwtSecret(env: Record<string, unknown>): string {
  // Layered on the generic presence helper: presence first (same error message
  // as every other required var), then the symmetric-secret strength floor.
  const secret = requireEnv(env, "AUTH_JWT_SECRET");

  if (!isStrongJwtSecret(secret)) {
    throw new Error(
      `AUTH_JWT_SECRET is too short (must be >= ${MIN_JWT_SECRET_LENGTH} characters).`,
    );
  }

  return secret;
}

export function createJwtSigner(env: Record<string, unknown>): JwtSigner {
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
  env: Record<string, unknown>;
  maxAgeSeconds?: number;
}): string {
  return stringifySetCookie({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function createAuthController(env: Record<string, unknown>) {
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
