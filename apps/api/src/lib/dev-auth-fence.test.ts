import { describe, it, expect } from "vitest";

import { assertNoDevAuthInProduction } from "./dev-auth-fence";

describe("assertNoDevAuthInProduction (Phase 29-04 / AUTH-01 boot fence)", () => {
  it("throws when NODE_ENV=production AND AUTH_DEV_MODE=true", () => {
    expect(() =>
      assertNoDevAuthInProduction({
        NODE_ENV: "production",
        AUTH_DEV_MODE: "true",
      }),
    ).toThrow(/AUTH_DEV_MODE refused outside test\/dev/);
  });

  it("throws when NODE_ENV=production AND AUTH_DEV_MODE_ALLOW_TEST=true", () => {
    expect(() =>
      assertNoDevAuthInProduction({
        NODE_ENV: "production",
        AUTH_DEV_MODE_ALLOW_TEST: "true",
      }),
    ).toThrow(/AUTH_DEV_MODE refused outside test\/dev/);
  });

  it("throws when NODE_ENV=production AND both flags true", () => {
    expect(() =>
      assertNoDevAuthInProduction({
        NODE_ENV: "production",
        AUTH_DEV_MODE: "true",
        AUTH_DEV_MODE_ALLOW_TEST: "true",
      }),
    ).toThrow(/AUTH_DEV_MODE refused outside test\/dev/);
  });

  it("does NOT throw when NODE_ENV=production AND neither flag true", () => {
    expect(() =>
      assertNoDevAuthInProduction({
        NODE_ENV: "production",
      }),
    ).not.toThrow();
  });

  it("does NOT throw when NODE_ENV=test AND AUTH_DEV_MODE_ALLOW_TEST=true (canary path)", () => {
    expect(() =>
      assertNoDevAuthInProduction({
        NODE_ENV: "test",
        AUTH_DEV_MODE_ALLOW_TEST: "true",
      }),
    ).not.toThrow();
  });

  it("does NOT throw when NODE_ENV=development AND AUTH_DEV_MODE=true", () => {
    expect(() =>
      assertNoDevAuthInProduction({
        NODE_ENV: "development",
        AUTH_DEV_MODE: "true",
      }),
    ).not.toThrow();
  });

  it("does NOT throw when NODE_ENV is undefined (treats as non-production)", () => {
    expect(() =>
      assertNoDevAuthInProduction({
        AUTH_DEV_MODE: "true",
      }),
    ).not.toThrow();
  });

  it('treats AUTH_DEV_MODE values other than the literal string "true" as false', () => {
    expect(() =>
      assertNoDevAuthInProduction({
        NODE_ENV: "production",
        AUTH_DEV_MODE: "1",
        AUTH_DEV_MODE_ALLOW_TEST: "TRUE",
      }),
    ).not.toThrow();
  });
});
