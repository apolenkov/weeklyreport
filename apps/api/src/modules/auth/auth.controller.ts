import { type UserSession, userSessionSchema } from "@customreport/shared";
import { serialize } from "cookie";
import jwt from "jsonwebtoken";

const ONE_HOUR_IN_SECONDS = 60 * 60;

export type JwtSigner = {
  signSession: (payload: UserSession) => string;
  verifySession: (token: string) => UserSession;
};

function requireJwtSecret(env: NodeJS.ProcessEnv): string {
  const secret = env.AUTH_JWT_SECRET;

  if (!secret) {
    throw new Error("Missing required environment variable: AUTH_JWT_SECRET");
  }

  return secret;
}

export function createJwtSigner(env: NodeJS.ProcessEnv): JwtSigner {
  const secret = requireJwtSecret(env);

  return {
    signSession(payload) {
      const parsedPayload = userSessionSchema.parse(payload);

      return jwt.sign(parsedPayload, secret, {
        algorithm: "HS256",
        expiresIn: ONE_HOUR_IN_SECONDS,
      });
    },
    verifySession(token) {
      const decoded = jwt.verify(token, secret);

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
