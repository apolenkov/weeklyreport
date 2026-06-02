import { userSessionSchema } from "@customreport/shared";
import type { Request } from "express";
import { ExtractJwt, type StrategyOptions } from "passport-jwt";

export type JwtStrategyOptions = StrategyOptions & {
  jwtCookieName: string;
};

function requireSecret(env: NodeJS.ProcessEnv): string {
  const secret = env.AUTH_JWT_SECRET;

  if (!secret) {
    throw new Error("Missing required environment variable: AUTH_JWT_SECRET");
  }

  return secret;
}

export function createJwtStrategyOptions(
  env: NodeJS.ProcessEnv,
): JwtStrategyOptions {
  const jwtCookieName = env.AUTH_JWT_COOKIE_NAME ?? "customreport_session";

  return {
    jwtCookieName,
    jwtFromRequest: ExtractJwt.fromExtractors([
      (request: Request) => {
        const cookies = request.cookies as Record<string, string> | undefined;
        return cookies?.[jwtCookieName] ?? null;
      },
    ]),
    ignoreExpiration: false,
    secretOrKey: requireSecret(env),
  };
}

export function validateJwtPayload(payload: unknown) {
  return userSessionSchema.parse(payload);
}
