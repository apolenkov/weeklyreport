import { afterEach, describe, expect, it, vi } from "vitest";

import {
  decodeTrpcBatchPayload,
  requireApiUrl,
  shouldUseDevAuthFallback,
} from "./api-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireApiUrl", () => {
  it("throws a descriptive error when API_URL is unset", () => {
    vi.stubEnv("API_URL", "");
    expect(() => requireApiUrl()).toThrow(/API_URL/);
  });

  it("throws when both vars are truly unset (undefined)", () => {
    vi.stubEnv("API_URL", undefined);
    expect(() => requireApiUrl()).toThrow(/API_URL/);
  });

  it("reads the server-side API_URL", () => {
    vi.stubEnv("API_URL", "http://api.internal:3001");
    expect(requireApiUrl()).toBe("http://api.internal:3001");
  });

  it.each([
    " ".repeat(3),
    "not-a-url",
    "/api",
    "//api.internal:3002",
    "http:api.internal:3002",
    "ftp://api.internal",
    "file:///tmp/api",
    "https://user:secret-marker@api.internal",
    "https://user@api.internal",
    "https://api.internal?token=secret-marker",
    "https://api.internal#secret-marker",
  ])("rejects invalid API_URL %s without echoing its contents", (value) => {
    vi.stubEnv("API_URL", value);
    expect(() => requireApiUrl()).toThrow(/API_URL/);
    expect(() => requireApiUrl()).not.toThrow(/secret-marker/);
  });

  it.each([
    ["http://localhost:3002/", "http://localhost:3002"],
    ["http://api:3002", "http://api:3002"],
    ["https://api.internal/base/", "https://api.internal/base"],
    ["HTTPS://api.internal/base/", "https://api.internal/base"],
    ["http://api:3001///", "http://api:3001"],
    [
      "https://api.internal/base//nested///",
      "https://api.internal/base//nested",
    ],
  ])("normalizes %s for appending API routes", (input, expected) => {
    vi.stubEnv("API_URL", input);
    expect(requireApiUrl()).toBe(expected);
  });
});

describe("decodeTrpcBatchPayload", () => {
  it("unwraps the superjson { json } wrapper", () => {
    const body = [{ result: { data: { json: { id: "u1" } } } }];
    expect(decodeTrpcBatchPayload(body)).toEqual({ id: "u1" });
  });

  it("rejects an untransformed payload", () => {
    const body = [{ result: { data: { id: "u1" } } }];
    expect(decodeTrpcBatchPayload(body)).toBeNull();
  });

  it("preserves a domain payload with its own json field", () => {
    const payload = { json: "domain value", id: "u1" };
    const body = [{ result: { data: { json: payload } } }];
    expect(decodeTrpcBatchPayload(body)).toEqual(payload);
  });

  it("preserves falsy-but-valid wrapped payloads (0, false, empty string)", () => {
    expect(decodeTrpcBatchPayload([{ result: { data: { json: 0 } } }])).toBe(0);
    expect(
      decodeTrpcBatchPayload([{ result: { data: { json: false } } }]),
    ).toBe(false);
    expect(decodeTrpcBatchPayload([{ result: { data: { json: "" } } }])).toBe(
      "",
    );
  });

  it("returns null for an error entry", () => {
    expect(decodeTrpcBatchPayload([{ error: { message: "boom" } }])).toBeNull();
  });

  it("returns null for a non-array or empty body", () => {
    expect(decodeTrpcBatchPayload({ result: {} })).toBeNull();
    expect(decodeTrpcBatchPayload([])).toBeNull();
  });

  it("returns null for null/undefined result data and wrapped null", () => {
    expect(decodeTrpcBatchPayload([{ result: {} }])).toBeNull();
    expect(decodeTrpcBatchPayload([{ result: { data: null } }])).toBeNull();
    expect(
      decodeTrpcBatchPayload([{ result: { data: { json: null } } }]),
    ).toBeNull();
  });
});

describe("shouldUseDevAuthFallback", () => {
  it("is true outside production when AUTH_DEV_MODE=true", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_DEV_MODE", "true");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "false");
    expect(shouldUseDevAuthFallback()).toBe(true);
  });

  it("is true outside production when AUTH_DEV_MODE_ALLOW_TEST=true", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_DEV_MODE", "false");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "true");
    expect(shouldUseDevAuthFallback()).toBe(true);
  });

  it("is false in production even with the flags set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_DEV_MODE", "true");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "true");
    expect(shouldUseDevAuthFallback()).toBe(false);
  });

  it("is false outside production when both flags are off", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_DEV_MODE", "false");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "false");
    expect(shouldUseDevAuthFallback()).toBe(false);
  });
});
