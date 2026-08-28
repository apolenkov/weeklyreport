import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  acceptanceEnvironmentFor,
  DEFAULT_ACCEPTANCE_API_PORT,
  DEFAULT_ACCEPTANCE_WEB_PORT,
} from "./config-environment.ts";

const E2E_DATABASE_URL =
  "postgresql://weeklyreport:test@127.0.0.1:5432/customreport_e2e";

describe("acceptance config environment", () => {
  it("uses explicit loopback URLs and deterministic default ports", () => {
    expect(acceptanceEnvironmentFor({ E2E_DATABASE_URL })).toEqual({
      apiPort: DEFAULT_ACCEPTANCE_API_PORT,
      apiUrl: `http://127.0.0.1:${DEFAULT_ACCEPTANCE_API_PORT}`,
      databaseUrl: E2E_DATABASE_URL,
      webPort: DEFAULT_ACCEPTANCE_WEB_PORT,
      webUrl: `http://127.0.0.1:${DEFAULT_ACCEPTANCE_WEB_PORT}`,
    });
  });

  it("rejects a missing disposable database target", () => {
    expect(() => acceptanceEnvironmentFor({})).toThrow(/DATABASE_URL not set/u);
  });

  it.each([
    "postgresql://weeklyreport:test@db.internal:5432/customreport_e2e",
    "postgresql://weeklyreport:test@127.0.0.1:5432/weeklyreport",
    "postgresql://weeklyreport:test@127.0.0.1:5432/customreport%5Fe2e",
    "postgresql://weeklyreport:test@127.0.0.1:5432/customreport_e2e?schema=public",
  ])("rejects an unsafe E2E target: %s", (databaseUrl) => {
    expect(() =>
      acceptanceEnvironmentFor({ E2E_DATABASE_URL: databaseUrl }),
    ).toThrow(/Refusing E2E\/runtime destructive operation/u);
  });

  it("rejects the development database under different credentials", () => {
    expect(() =>
      acceptanceEnvironmentFor({
        DATABASE_URL:
          "postgresql://developer:other@localhost:5432/customreport_e2e",
        E2E_DATABASE_URL,
      }),
    ).toThrow(/must differ from DATABASE_URL/u);
  });

  it.each(["", "0", "03122", "3122.5", "65536", "not-a-port"])(
    "rejects invalid application port %j",
    (port) => {
      expect(() =>
        acceptanceEnvironmentFor({
          ACCEPTANCE_API_PORT: port,
          E2E_DATABASE_URL,
        }),
      ).toThrow(/ACCEPTANCE_API_PORT must be an exact TCP port/u);
    },
  );

  it("rejects an API/web port collision", () => {
    expect(() =>
      acceptanceEnvironmentFor({
        ACCEPTANCE_API_PORT: "3122",
        ACCEPTANCE_WEB_PORT: "3122",
        E2E_DATABASE_URL,
      }),
    ).toThrow(/must differ/u);
  });
});

describe("acceptance Playwright config", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("E2E_DATABASE_URL", E2E_DATABASE_URL);
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://weeklyreport:test@127.0.0.1:5432/weeklyreport_dev",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defines the two serial projects and Playwright-owned loopback servers", async () => {
    const { default: config } = await import("./playwright.config.ts");
    const servers = Array.isArray(config.webServer) ? config.webServer : [];

    expect(config.workers).toBe(1);
    expect(config.fullyParallel).toBe(false);
    expect(config.projects?.map(({ name }) => name)).toEqual([
      "route-health",
      "critical-journeys",
    ]);
    expect(servers.map(({ url }) => url)).toEqual([
      "http://127.0.0.1:3122/health/ready",
      "http://127.0.0.1:3125",
    ]);
    expect(config.use?.trace).toBe("retain-on-failure");
    expect(config.use?.screenshot).toBe("only-on-failure");
    expect(config.use?.video).toBe("retain-on-failure");
  });
});
