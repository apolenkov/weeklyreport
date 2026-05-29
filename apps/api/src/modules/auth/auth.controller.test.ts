import type { UserSession } from "@customreport/shared";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import { createJwtSigner } from "./auth.controller";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests — AUTH-033..036 regression scenarios
// ---------------------------------------------------------------------------

describe("createJwtSigner — contract tests", () => {
  it("signs and verifies a valid session (AUTH-033 P0)", () => {
    const signer = createJwtSigner(TEST_ENV);
    const token = signer.signSession(validSession);

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT has 3 parts

    const verified = signer.verifySession(token);
    expect(verified.userId).toBe(validSession.userId);
    expect(verified.email).toBe(validSession.email);
    expect(verified.role).toBe(validSession.role);
  });

  it("expired JWT throws on verify (AUTH-034 P0)", () => {
    // Sign a token that already expired
    const expiredToken = jwt.sign(
      { ...validSession },
      TEST_SECRET,
      { algorithm: "HS256", expiresIn: -10 }, // expired 10 seconds ago
    );

    const signer = createJwtSigner(TEST_ENV);
    expect(() => signer.verifySession(expiredToken)).toThrow();
  });

  it("invalid JWT (bad signature) throws on verify (AUTH-035 P0)", () => {
    const signer = createJwtSigner(TEST_ENV);
    const token = signer.signSession(validSession);

    // Tamper with the token signature
    const tamperedToken = token.slice(0, -5) + "xxxxx";

    expect(() => signer.verifySession(tamperedToken)).toThrow();
  });

  it("malformed JWT string throws on verify", () => {
    const signer = createJwtSigner(TEST_ENV);

    expect(() => signer.verifySession("not-a-jwt")).toThrow();
  });

  it("JWT signed with different secret throws on verify", () => {
    const otherEnv = {
      AUTH_JWT_SECRET: "different-secret",
    } as unknown as NodeJS.ProcessEnv;
    const otherSigner = createJwtSigner(otherEnv);
    const tokenFromOtherSecret = otherSigner.signSession(validSession);

    const signer = createJwtSigner(TEST_ENV);
    expect(() => signer.verifySession(tokenFromOtherSecret)).toThrow();
  });

  it("throws when AUTH_JWT_SECRET is missing", () => {
    expect(() => createJwtSigner({} as unknown as NodeJS.ProcessEnv)).toThrow(
      "Missing required environment variable: AUTH_JWT_SECRET",
    );
  });

  it("signed token contains all session fields", () => {
    const signer = createJwtSigner(TEST_ENV);
    const token = signer.signSession(validSession);
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(decoded["userId"]).toBe(validSession.userId);
    expect(decoded["email"]).toBe(validSession.email);
    expect(decoded["name"]).toBe(validSession.name);
    expect(decoded["role"]).toBe(validSession.role);
    expect(decoded["activeReportId"]).toBe(validSession.activeReportId);
    expect(decoded["activeReportSectionId"]).toBeNull();
  });

  it("signed token has exp claim (1 hour TTL)", () => {
    const signer = createJwtSigner(TEST_ENV);
    const token = signer.signSession(validSession);
    const decoded = jwt.decode(token) as Record<string, unknown>;

    expect(typeof decoded["exp"]).toBe("number");
    expect(typeof decoded["iat"]).toBe("number");
    // exp should be ~3600 seconds after iat
    const diff = (decoded["exp"] as number) - (decoded["iat"] as number);
    expect(diff).toBe(3600);
  });
});
