import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertE2eRuntimeDestructive,
  assertE2eRuntimeDestructiveTarget,
  E2E_DESTRUCTIVE_CONSENT,
  isLoopbackHost,
  parseE2eRuntimeDatabaseTarget,
  parseE2eRuntimeRedisTarget,
  parseLoopbackHost,
} from "./_destructive-guard.js";

const TARGET = "postgresql://customreport:secret@127.0.0.1:5432/";

function targetUrl(database: string, host = "127.0.0.1"): string {
  const renderedHost = host.includes(":") ? `[${host}]` : host;
  return `${TARGET.replace("127.0.0.1", renderedHost)}${database}`;
}

function validEnv(databaseUrl = targetUrl("customreport_e2e")) {
  return {
    DATABASE_URL: databaseUrl,
    NODE_ENV: "test",
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: E2E_DESTRUCTIVE_CONSENT,
  } as const;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("exact E2E/runtime destructive target", () => {
  it.each([
    "customreport_e2e",
    "customreport_e2e_lane_a_test",
    "customreport_e2e_lane_o_test",
  ])("accepts the authorized database %s", (database) => {
    expect(() =>
      assertE2eRuntimeDestructiveTarget(
        "guard-test",
        targetUrl(database),
        validEnv(targetUrl(database)),
      ),
    ).not.toThrow();
  });

  it.each([
    "customreport_e2e_dev",
    "customreport_e2e_lane_p_test",
    "customreport_e2e_lane_aa_test",
    "customreport_e2e_lane_a",
    "customreport",
    "production",
  ])("rejects unauthorized database %s", (database) => {
    expect(() =>
      assertE2eRuntimeDestructiveTarget(
        "guard-test",
        targetUrl(database),
        validEnv(targetUrl(database)),
      ),
    ).toThrow(/database name/iu);
  });

  it.each(["localhost", "127.0.0.1", "127.255.255.255", "::1"])(
    "accepts loopback host %s",
    (host) => {
      const url = targetUrl("customreport_e2e", host);
      expect(() =>
        assertE2eRuntimeDestructiveTarget("guard-test", url, validEnv(url)),
      ).not.toThrow();
    },
  );

  it.each(["127.1.2.3", "::ffff:127.1.2.3", "::ffff:7f01:203"])(
    "accepts the mapped/non-octet-aligned loopback host %s",
    (host) => {
      const url = targetUrl("customreport_e2e", host);
      expect(() =>
        assertE2eRuntimeDestructiveTarget("guard-test", url, validEnv(url)),
      ).not.toThrow();
    },
  );

  it.each([
    "126.255.255.255",
    "128.0.0.1",
    "::ffff:8.8.8.8",
    "::ffff:808:808",
    "::ffff:7f00:1zz",
    "::ffff:7f00:10000",
  ])("rejects the non-loopback or malformed host %s", (host) => {
    const url = targetUrl("customreport_e2e", host);
    expect(() =>
      assertE2eRuntimeDestructiveTarget("guard-test", url, validEnv(url)),
    ).toThrow();
  });

  it.each([
    ["::1]", false],
    ["[::1", false],
    ["[localhost]", false],
    ["[127.0.0.1]", false],
    ["::ffff:127.0.0.1", true],
    ["::ffff:7f00:1", true],
    ["::ffff:808:808", false],
    [" LOCALHOST", false],
    ["LocalHost", true],
  ])("isLoopbackHost(%s) → %s", (host, expected) => {
    expect(isLoopbackHost(host)).toBe(expected);
  });

  it.each([
    ["[::1]", "::1"],
    ["LOCALHOST", "localhost"],
    ["127.0.0.1", "127.0.0.1"],
    ["[::ffff:127.0.0.1]", "::ffff:127.0.0.1"],
  ])("parseLoopbackHost(%s) normalizes to %s", (host, expected) => {
    expect(parseLoopbackHost(host)).toBe(expected);
  });

  it("returns a dialable unbracketed Redis host for [::1]", () => {
    const env = {
      DATABASE_URL: targetUrl("customreport_e2e"),
      REDIS_DB: "15",
      REDIS_HOST: "[::1]",
      REDIS_PORT: "6379",
    };

    expect(parseE2eRuntimeRedisTarget("guard-test", env).host).toBe("::1");
  });

  it.each([
    "postgresql://customreport:secret@postgres:5432/customreport_e2e",
    "postgresql://customreport:secret@db.local:5432/customreport_e2e",
    "postgresql://customreport:secret@192.168.1.2:5432/customreport_e2e",
  ])("rejects a non-loopback host: %s", (url) => {
    expect(() =>
      assertE2eRuntimeDestructiveTarget("guard-test", url, validEnv(url)),
    ).toThrow(/not loopback/iu);
  });

  it.each([
    "postgresql://127.0.0.1/%63ustomreport_e2e",
    "postgresql://127.0.0.1/CustomReport_e2e",
    "postgresql://127.0.0.1/customreport_e2e%20",
    " postgresql://127.0.0.1/customreport_e2e",
    "postgresql://127.0.0.1/customreport_e2e ",
    "postgresql://127.0.0.1/customreport_e2e?schema=public",
    "postgresql://127.0.0.1/customreport_e2e#fragment",
    "postgresql://127.0.0.1/customreport_e2e?",
    "postgresql://127.0.0.1/customreport_e2e#",
    "postgresql://127.0.0.1/customreport_e2e?#",
    "postgre\nsql://127.0.0.1/customreport_e2e",
    "postgresql://127.0.0.1/cu\tstomreport_e2e",
    "postgresql://127.0.0.1/customreport_e2e/extra",
    "postgresql://127.0.0.1/customreport_e2e%2Fextra",
    "postgresql://127.0.0.1/other/../customreport_e2e",
    "postgresql://127.0.0.1/%2e/customreport_e2e",
    "postgresql://127.0.0.1:0/customreport_e2e",
    "postgresql://127.0.0.1:/customreport_e2e",
    "postgresql://127.0.0.1:05432/customreport_e2e",
    "postgresql://[::1]:/customreport_e2e",
    "mysql://127.0.0.1/customreport_e2e",
    "not a URL",
  ])("rejects malformed or ambiguous target %s", (url) => {
    expect(() =>
      assertE2eRuntimeDestructiveTarget("guard-test", url, validEnv(url)),
    ).toThrow();
  });

  it("requires the exact per-run consent", () => {
    const url = targetUrl("customreport_e2e");
    expect(() =>
      assertE2eRuntimeDestructiveTarget("guard-test", url, {
        ...validEnv(url),
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "да",
      }),
    ).toThrow(/must equal/iu);
  });

  it("rejects production regardless of target or override variable", () => {
    const url = targetUrl("customreport_e2e");
    expect(() =>
      assertE2eRuntimeDestructiveTarget("guard-test", url, {
        ...validEnv(url),
        ALLOW_PROD_DESTRUCTIVE: "yes",
        NODE_ENV: "production",
      }),
    ).toThrow(/NODE_ENV=production/iu);
  });

  it("does not let ALLOW_PROD_DESTRUCTIVE bypass an unsafe target", () => {
    const url =
      "postgresql://customreport:secret@db.internal:5432/customreport";
    expect(() =>
      assertE2eRuntimeDestructiveTarget("guard-test", url, {
        ...validEnv(url),
        ALLOW_PROD_DESTRUCTIVE: "yes",
      }),
    ).toThrow(/cannot bypass/iu);
  });

  it("redacts credentials from refusal diagnostics", () => {
    const url =
      "postgresql://customreport:super-secret@db.internal:5432/customreport";
    let error: unknown;
    try {
      assertE2eRuntimeDestructiveTarget("guard-test", url, validEnv(url));
    } catch (caughtError: unknown) {
      error = caughtError;
    }
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain("super-secret");
    expect(String(error)).toContain(":***@");
  });

  it("does not echo credentials from malformed URL diagnostics", () => {
    const url = "postgresql://operator:malformed-secret/path@";
    let error: unknown;
    try {
      assertE2eRuntimeDestructiveTarget("guard-test", url, validEnv(url));
    } catch (caughtError: unknown) {
      error = caughtError;
    }
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain("malformed-secret");
    expect(String(error)).not.toContain(url);
    expect(String(error)).toContain("<redacted>");
  });

  it.each([
    "postgresql://operator:credential@localhost/customreport_e2e?token=query-sentinel",
    "postgresql://operator:credential@localhost/customreport_e2e#fragment-sentinel",
  ])("does not echo query or fragment secrets from %s", (url) => {
    let error: unknown;
    try {
      assertE2eRuntimeDestructiveTarget("guard-test", url, validEnv(url));
    } catch (caughtError: unknown) {
      error = caughtError;
    }
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain("query-sentinel");
    expect(String(error)).not.toContain("fragment-sentinel");
    expect(String(error)).not.toContain("credential@");
  });

  it("has a side-effect-free parser for target identity", () => {
    expect(
      parseE2eRuntimeDatabaseTarget(
        "guard-test",
        targetUrl("customreport_e2e_lane_b_test"),
      ),
    ).toEqual({
      database: "customreport_e2e_lane_b_test",
      host: "127.0.0.1",
      port: "5432",
    });
  });

  it("does not let ALLOW_PROD_DESTRUCTIVE affect the exact contract", () => {
    const env = validEnv();
    vi.stubEnv("DATABASE_URL", env.DATABASE_URL);
    vi.stubEnv("NODE_ENV", env.NODE_ENV);
    vi.stubEnv(
      "PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION",
      env.PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION,
    );
    vi.stubEnv("ALLOW_PROD_DESTRUCTIVE", "yes");
    expect(() => assertE2eRuntimeDestructive("exact-env")).not.toThrow();
  });
});
