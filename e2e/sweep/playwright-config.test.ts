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
  vi.stubEnv(
    "DATABASE_URL",
    "postgres://dev-user:dev-password@LOCALHOST/customreport_dev",
  );
  vi.stubEnv(
    "E2E_DATABASE_URL",
    "postgresql://e2e-user:e2e-password@localhost:5432/customreport_dev",
  );

  await expect(import("./playwright.config.ts")).rejects.toThrow(
    "E2E_DATABASE_URL must differ from DATABASE_URL for the UAT sweep.",
  );
});

test.each([
  "https://localhost/customreport_e2e",
  "not-a-database-url",
  "postgres:///customreport_e2e",
  "postgres://localhost",
  "postgres://localhost/customreport/e2e",
])("rejects a non-PostgreSQL UAT database URL: %s", async (databaseUrl) => {
  vi.stubEnv("E2E_DATABASE_URL", databaseUrl);

  await expect(import("./playwright.config.ts")).rejects.toThrow(
    "UAT database URLs must be valid PostgreSQL URLs.",
  );
});

test("does not expose database credentials in validation errors", async () => {
  const secret = "must-not-leak";
  vi.stubEnv(
    "E2E_DATABASE_URL",
    `https://uat-user:${secret}@localhost/customreport_e2e`,
  );

  const error = await import("./playwright.config.ts").catch(
    (error_: unknown) => error_,
  );
  if (!(error instanceof Error)) {
    throw new TypeError("Expected UAT database validation to reject");
  }

  expect(error.message).toBe(
    "UAT database URLs must be valid PostgreSQL URLs.",
  );
  expect(error.message).not.toContain(secret);
});
