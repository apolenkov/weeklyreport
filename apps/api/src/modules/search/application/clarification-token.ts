import { createHmac } from "node:crypto";

import jwt from "jsonwebtoken";

import {
  type AliasKind,
  normalizeEntityReference,
} from "../domain/entity-alias-index.js";

const CLARIFICATION_TOKEN_TTL_MINUTES = 5;
const SECONDS_PER_MINUTE = 60;
const CLARIFICATION_TOKEN_TTL_SECONDS =
  CLARIFICATION_TOKEN_TTL_MINUTES * SECONDS_PER_MINUTE;
const MIN_AUTH_JWT_SECRET_LENGTH = 32;
const CLARIFICATION_TOKEN_PURPOSE =
  "customreport/lead-report-assistant/clarification/v1";
const CLARIFICATION_TOKEN_ALGORITHM = "HS256" as const;

export const CLARIFICATION_TOKEN_KIND =
  "lead-report-assistant-clarification" as const;
export const CLARIFICATION_TOKEN_AUDIENCE = "lead-report-assistant" as const;

export type ClarificationTokenClaims = Readonly<{
  actorId: string;
  entityKind: AliasKind;
  entityId: string;
  reference: string;
}>;

type ClarificationTokenEnv = Readonly<{
  AUTH_JWT_SECRET?: string;
}>;

function requireAuthJwtSecret(env: ClarificationTokenEnv): string {
  const secret = env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: AUTH_JWT_SECRET");
  }
  if (secret.length < MIN_AUTH_JWT_SECRET_LENGTH) {
    throw new Error(
      `AUTH_JWT_SECRET is too short (must be >= ${MIN_AUTH_JWT_SECRET_LENGTH} characters).`,
    );
  }
  return secret;
}

export function deriveClarificationSigningKey(secret: string): string {
  return createHmac("sha256", secret)
    .update(CLARIFICATION_TOKEN_PURPOSE)
    .digest("hex");
}

const isAliasKind = (value: unknown): value is AliasKind =>
  value === "author" ||
  value === "product" ||
  value === "activity" ||
  value === "period";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

function parseClaims(
  decoded: string | jwt.JwtPayload,
  actorId: string,
): ClarificationTokenClaims | null {
  if (typeof decoded === "string") return null;

  const { actorId: claimActorId, entityId, entityKind, reference } = decoded;
  if (
    claimActorId !== actorId ||
    decoded.sub !== actorId ||
    !isNonEmptyString(entityId) ||
    !isAliasKind(entityKind) ||
    !isNonEmptyString(reference)
  ) {
    return null;
  }

  const normalizedReference = normalizeEntityReference(reference);
  return normalizedReference
    ? { actorId, entityKind, entityId, reference: normalizedReference }
    : null;
}

export function createClarificationTokenCodec(env: ClarificationTokenEnv) {
  const signingKey = deriveClarificationSigningKey(requireAuthJwtSecret(env));

  return {
    encode(input: ClarificationTokenClaims): string {
      const claims: ClarificationTokenClaims & {
        kind: typeof CLARIFICATION_TOKEN_KIND;
      } = {
        ...input,
        reference: normalizeEntityReference(input.reference),
        kind: CLARIFICATION_TOKEN_KIND,
      };
      if (!claims.reference) {
        throw new Error("Clarification token reference must not be empty.");
      }

      return jwt.sign(claims, signingKey, {
        algorithm: CLARIFICATION_TOKEN_ALGORITHM,
        audience: CLARIFICATION_TOKEN_AUDIENCE,
        expiresIn: CLARIFICATION_TOKEN_TTL_SECONDS,
        subject: input.actorId,
      });
    },
    decode(token: string, actorId: string): ClarificationTokenClaims | null {
      try {
        const decoded = jwt.verify(token, signingKey, {
          algorithms: [CLARIFICATION_TOKEN_ALGORITHM],
          audience: CLARIFICATION_TOKEN_AUDIENCE,
        });
        if (
          typeof decoded !== "object" ||
          decoded.kind !== CLARIFICATION_TOKEN_KIND
        ) {
          return null;
        }
        return parseClaims(decoded, actorId);
      } catch {
        return null;
      }
    },
  };
}
