import { afterEach, describe, expect, it, vi } from "vitest";

import { assertNonProdDestructive } from "./_destructive-guard.js";

function setDatabaseUrl(url: string): void {
  vi.stubEnv("ALLOW_PROD_DESTRUCTIVE", "");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DATABASE_URL", url);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertNonProdDestructive credential-less URLs", () => {
  it("allows an explicit production-destructive override", () => {
    vi.stubEnv("ALLOW_PROD_DESTRUCTIVE", "yes");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "not a URL");

    expect(() => assertNonProdDestructive("test-script")).not.toThrow();
  });

  it("refuses a malformed database URL", () => {
    setDatabaseUrl("not a URL");

    expect(() => assertNonProdDestructive("test-script")).toThrow(
      "DATABASE_URL is not a parseable URL.",
    );
  });

  it("recognizes localhost without requiring a non-production suffix", () => {
    setDatabaseUrl("postgresql://localhost/customreport");

    expect(() => assertNonProdDestructive("test-script")).not.toThrow();
  });

  it("allows a non-local host when the database name is explicitly test-only", () => {
    setDatabaseUrl("postgresql://myhost.internal/app_test");

    expect(() => assertNonProdDestructive("test-script")).not.toThrow();
  });

  it("reports the parsed non-local host when the database lacks a safe suffix", () => {
    setDatabaseUrl("postgresql://myhost.internal/app");

    expect(() => assertNonProdDestructive("test-script")).toThrow(
      'Host "myhost.internal" is not local and database "app" lacks non-prod suffix',
    );
  });

  it("still refuses a production-looking database name", () => {
    setDatabaseUrl("postgresql://myhost.internal/app_prod");

    expect(() => assertNonProdDestructive("test-script")).toThrow(
      'Database name "app_prod" looks like production.',
    );
  });
});
