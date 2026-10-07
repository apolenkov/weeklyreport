import type { UserSession } from "@customreport/shared";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import { createJwtSigner } from "./auth.controller";

const TEST_SECRET = "test-jwt-secret-for-unit-tests-only";
const TEST_ENV = {
  AUTH_JWT_SECRET: TEST_SECRET,
} as unknown as NodeJS.ProcessEnv;

const validSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "head@customreport.local",
  name: "Department Head",
  role: "head",
  activeReportId: "22222222-2222-4222-8222-222222222222",
  activeReportSectionId: null,
};

describe("createJwtSigner — contract tests", () => {
  it("signs and verifies a valid session", () => {
    const signer = createJwtSigner(TEST_ENV);
    const token = signer.signSession(validSession);

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const verified = signer.verifySession(token);
    expect(verified.userId).toBe(validSession.userId);
    expect(verified.email).toBe(validSession.email);
    expect(verified.role).toBe(validSession.role);
  });

  it("expired JWT throws on verify", () => {
    const expiredToken = jwt.sign({ ...validSession }, TEST_SECRET, {
      algorithm: "HS256",
      expiresIn: -10,
    });

    const signer = createJwtSigner(TEST_ENV);
    expect(() => signer.verifySession(expiredToken)).toThrow();
  });

  it("invalid JWT (bad signature) throws on verify", () => {
    const signer = createJwtSigner(TEST_ENV);
    const token = signer.signSession(validSession);

    const tamperedToken = `${token.slice(0, -5)}xxxxx`;

    expect(() => signer.verifySession(tamperedToken)).toThrow();
  });

  it("malformed JWT string throws on verify", () => {
    const signer = createJwtSigner(TEST_ENV);

    expect(() => signer.verifySession("not-a-jwt")).toThrow();
  });

  it("JWT signed with different secret throws on verify", () => {
    const otherEnv = {
      AUTH_JWT_SECRET: "a-different-but-still-long-enough-secret",
    } as unknown as NodeJS.ProcessEnv;
    const otherSigner = createJwtSigner(otherEnv);
    const tokenFromOtherSecret = otherSigner.signSession(validSession);

    const signer = createJwtSigner(TEST_ENV);
    expect(() => signer.verifySession(tokenFromOtherSecret)).toThrow();
  });

  it("rejects a token signed with a non-HS256 algorithm (algorithm pin)", () => {
    // Same secret, but signed with HS384 — the verify algorithm pin must reject
    // it even though the secret matches, so the token cannot be coerced into a
    // different algorithm.
    const hs384Token = jwt.sign({ ...validSession }, TEST_SECRET, {
      algorithm: "HS384",
      expiresIn: 3600,
    });

    const signer = createJwtSigner(TEST_ENV);
    expect(() => signer.verifySession(hs384Token)).toThrow();

    const hs256Token = signer.signSession(validSession);
    expect(signer.verifySession(hs256Token).userId).toBe(validSession.userId);
  });

  it("throws when AUTH_JWT_SECRET is missing", () => {
    expect(() => createJwtSigner({})).toThrow(
      "Missing required environment variable: AUTH_JWT_SECRET",
    );
  });

  it("throws when AUTH_JWT_SECRET is shorter than 32 characters", () => {
    const shortEnv = {
      AUTH_JWT_SECRET: "too-short",
    } as unknown as NodeJS.ProcessEnv;

    expect(() => createJwtSigner(shortEnv)).toThrow(/>= 32 characters/);
  });

  it("accepts an AUTH_JWT_SECRET of exactly 32 characters", () => {
    const exact32 = "a".repeat(32);
    const env32 = {
      AUTH_JWT_SECRET: exact32,
    } as unknown as NodeJS.ProcessEnv;

    expect(() => createJwtSigner(env32)).not.toThrow();
  });

  it.each([
    " ".repeat(32),
    `  ${"b".repeat(30)}  `,
    ` ${"change-me".padEnd(31, "-")} `,
  ])("rejects a whitespace-padded weak secret %j", (AUTH_JWT_SECRET) => {
    const env = { AUTH_JWT_SECRET } as unknown as NodeJS.ProcessEnv;

    expect(() => createJwtSigner(env)).toThrow(/>= 32 characters/);
  });

  it("signed token contains all session fields", () => {
    const signer = createJwtSigner(TEST_ENV);
    const token = signer.signSession(validSession);
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(decoded.userId).toBe(validSession.userId);
    expect(decoded.email).toBe(validSession.email);
    expect(decoded.name).toBe(validSession.name);
    expect(decoded.role).toBe(validSession.role);
    expect(decoded.activeReportId).toBe(validSession.activeReportId);
    expect(decoded.activeReportSectionId).toBeNull();
  });

  it("signed token has exp claim (1 hour TTL)", () => {
    const signer = createJwtSigner(TEST_ENV);
    const token = signer.signSession(validSession);
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(typeof decoded.exp).toBe("number");
    expect(typeof decoded.iat).toBe("number");

    const diff = (decoded.exp as number) - (decoded.iat as number);
    expect(diff).toBe(3600);
  });
});
