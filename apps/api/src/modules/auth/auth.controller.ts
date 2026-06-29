import { type UserSession, userSessionSchema } from "@customreport/shared";
import { serialize } from "cookie";
import jwt from "jsonwebtoken";

const ONE_HOUR_IN_SECONDS = 60 * 60;

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
  const secret = env.AUTH_JWT_SECRET;

  if (!secret) {
    throw new Error("Missing required environment variable: AUTH_JWT_SECRET");
  }

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

export function createSessionCookie(
  token: string,
  env: NodeJS.ProcessEnv,
): string {
  return serialize(env.AUTH_JWT_COOKIE_NAME ?? "customreport_session", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_HOUR_IN_SECONDS,
  });
}

export function createAuthController(env: NodeJS.ProcessEnv) {
  const jwtSigner = createJwtSigner(env);

  return {
    issueSessionCookie(payload: UserSession) {
      const token = jwtSigner.signSession(payload);

      return {
        token,
        setCookieHeader: createSessionCookie(token, env),
      };
    },
    verifySessionToken(token: string) {
      return jwtSigner.verifySession(token);
    },
  };
}
