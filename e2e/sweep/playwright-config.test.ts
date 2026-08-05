import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test("starts current-source servers against the dedicated UAT database", async () => {
  const databaseUrl = "postgresql://customreport@localhost/customreport_uat";
  vi.stubEnv("E2E_DATABASE_URL", databaseUrl);
  const { default: config } = await import("./playwright.config.ts");
  const servers = config.webServer;
  if (!Array.isArray(servers)) {
    throw new TypeError("The UAT sweep requires API and web server entries");
  }

  const [apiServer, webServer] = servers;
  if (!apiServer || !webServer) {
    throw new TypeError("The UAT sweep server configuration is incomplete");
  }

  expect(apiServer.reuseExistingServer).toBe(false);
  expect(webServer.reuseExistingServer).toBe(false);
  expect(apiServer.command).toContain("src/main.ts");
  expect(apiServer.env?.DATABASE_URL).toBe(databaseUrl);
  expect(webServer.command).toMatch(/next dev --webpack -p \d+$/);
});

test("fails closed without a dedicated UAT database", async () => {
  vi.stubEnv("E2E_DATABASE_URL", "");

  await expect(import("./playwright.config.ts")).rejects.toThrow(
    "E2E_DATABASE_URL must be set to a disposable database for the UAT sweep.",
  );
});

test("rejects the development database as the UAT target", async () => {
  const developmentDatabaseUrl =
    "postgresql://customreport@localhost/customreport_dev";
  vi.stubEnv("DATABASE_URL", developmentDatabaseUrl);
  vi.stubEnv("E2E_DATABASE_URL", developmentDatabaseUrl);

  await expect(import("./playwright.config.ts")).rejects.toThrow(
    "E2E_DATABASE_URL must differ from DATABASE_URL for the UAT sweep.",
  );
});
