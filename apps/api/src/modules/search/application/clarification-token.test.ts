import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import { createJwtSigner } from "../../auth/auth.controller.js";
import {
  CLARIFICATION_TOKEN_AUDIENCE,
  CLARIFICATION_TOKEN_KIND,
  createClarificationTokenCodec,
  deriveClarificationSigningKey,
} from "./clarification-token.js";

const secret = "clarification-test-secret-with-at-least-32-chars";
const env = { AUTH_JWT_SECRET: secret } as NodeJS.ProcessEnv;
const actorId = "actor-a";
const tokenInput = {
  actorId,
  entityKind: "product" as const,
  entityId: "product-a",
  reference: "  Platform—API ",
};

describe("clarification token codec", () => {
  it("round-trips a normalized, actor-bound claim", () => {
    const codec = createClarificationTokenCodec(env);
    const token = codec.encode(tokenInput);

    expect(codec.decode(token, actorId)).toEqual({
      ...tokenInput,
      reference: "platform-api",
    });
  });

  it("rejects a token for another actor", () => {
    const codec = createClarificationTokenCodec(env);
    expect(codec.decode(codec.encode(tokenInput), "actor-b")).toBeNull();
  });

  it("rejects tampered and expired tokens", () => {
    const codec = createClarificationTokenCodec(env);
    const token = codec.encode(tokenInput);
    const expired = jwt.sign(
      { ...tokenInput, kind: CLARIFICATION_TOKEN_KIND },
      deriveClarificationSigningKey(secret),
      {
        algorithm: "HS256",
        audience: CLARIFICATION_TOKEN_AUDIENCE,
        expiresIn: -1,
        subject: actorId,
      },
    );

    expect(codec.decode(`${token}tampered`, actorId)).toBeNull();
    expect(codec.decode(expired, actorId)).toBeNull();
  });

  it("rejects a different kind and cannot be used as a session JWT", () => {
    const codec = createClarificationTokenCodec(env);
    const wrongKind = jwt.sign(
      { ...tokenInput, kind: "session" },
      deriveClarificationSigningKey(secret),
      {
        algorithm: "HS256",
        audience: CLARIFICATION_TOKEN_AUDIENCE,
        expiresIn: 300,
        subject: actorId,
      },
    );
    const sessionSigner = createJwtSigner(env);

    expect(codec.decode(wrongKind, actorId)).toBeNull();
    expect(() =>
      sessionSigner.verifySession(codec.encode(tokenInput)),
    ).toThrow();
  });

  it("requires the existing session secret and its strength floor", () => {
    expect(() => createClarificationTokenCodec({})).toThrow(
      "Missing required environment variable: AUTH_JWT_SECRET",
    );
    expect(() =>
      createClarificationTokenCodec({ AUTH_JWT_SECRET: "short" }),
    ).toThrow(/>= 32 characters/);
  });
});
