import pg from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  confirmationToken,
  MigratorConfigError,
  parseDatabaseTarget,
  resolveConfig,
} from "./config.js";

const BASE_ENV = {
  DATABASE_URL:
    "postgresql://customreport:localdev@localhost:5432/customreport_e2e",
  PDF_OUTPUT_DIR: "/var/lib/customreport/pdfs",
} as const;

describe("resolveConfig", () => {
  it("defaults to check mode when PDF_ARTIFACT_MIGRATOR_MODE is unset", () => {
    const config = resolveConfig({ ...BASE_ENV });
    expect(config.mode).toBe("check");
    expect(config.databaseUrl).toBe(BASE_ENV.DATABASE_URL);
    expect(config.artifactRoot).toBe("/var/lib/customreport/pdfs");
  });

  it("accepts apply and rollback modes verbatim", () => {
    expect(
      resolveConfig({ ...BASE_ENV, PDF_ARTIFACT_MIGRATOR_MODE: "apply" }).mode,
    ).toBe("apply");
    expect(
      resolveConfig({ ...BASE_ENV, PDF_ARTIFACT_MIGRATOR_MODE: "rollback" })
        .mode,
    ).toBe("rollback");
  });

  it("refuses an unknown mode", () => {
    expect(() =>
      resolveConfig({ ...BASE_ENV, PDF_ARTIFACT_MIGRATOR_MODE: "destroy" }),
    ).toThrow(MigratorConfigError);
  });

  it("refuses a missing DATABASE_URL", () => {
    expect(() => resolveConfig({ PDF_OUTPUT_DIR: "/pdfs" })).toThrow(
      MigratorConfigError,
    );
  });

  it("refuses a missing PDF_OUTPUT_DIR", () => {
    expect(() =>
      resolveConfig({ DATABASE_URL: BASE_ENV.DATABASE_URL }),
    ).toThrow(MigratorConfigError);
  });

  it("refuses a relative PDF_OUTPUT_DIR: the artifact root must be absolute", () => {
    expect(() =>
      resolveConfig({ ...BASE_ENV, PDF_OUTPUT_DIR: "data/pdfs" }),
    ).toThrow(MigratorConfigError);
  });

  it("carries the optional confirmation token through unchanged", () => {
    const config = resolveConfig({
      ...BASE_ENV,
      PDF_ARTIFACT_MIGRATOR_CONFIRM: "localhost|5432|customreport_e2e",
    });
    expect(config.confirmation).toBe("localhost|5432|customreport_e2e");
  });
});

describe("parseDatabaseTarget", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("extracts host, explicit port and database", () => {
    expect(
      parseDatabaseTarget(
        "postgresql://user:pw@db.example.com:5544/weekly_report",
      ),
    ).toEqual({ host: "db.example.com", port: "5544", database: "weekly_report" });
  });

  // pg.Client resolves a portless URL through process.env.PGPORT at connect
  // time, so a token computed as 5432 would bind a different target than the
  // one pg dials. The port must come from the URL, never ambient env.
  it("refuses an omitted port: pg would inherit PGPORT instead of 5432", () => {
    vi.stubEnv("PGPORT", "6543");
    const client = new pg.Client({
      connectionString: "postgresql://u:p@db.example.com/customreport_e2e",
    });
    const resolved = (
      client as unknown as { connectionParameters: { port: number } }
    ).connectionParameters.port;
    expect(resolved).toBe(6543);

    expect(() =>
      parseDatabaseTarget("postgresql://u:p@db.example.com/customreport_e2e"),
    ).toThrow(/explicit port/u);
  });

  it("binds an explicit port even when PGPORT disagrees", () => {
    vi.stubEnv("PGPORT", "6543");
    const client = new pg.Client({
      connectionString: "postgresql://u:p@db.example.com:5432/customreport_e2e",
    });
    const resolved = (
      client as unknown as { connectionParameters: { port: number } }
    ).connectionParameters.port;
    expect(resolved).toBe(5432);
    expect(
      parseDatabaseTarget("postgresql://u:p@db.example.com:5432/customreport_e2e"),
    ).toEqual({
      host: "db.example.com",
      port: "5432",
      database: "customreport_e2e",
    });
  });

  it("normalizes host case and a trailing dot", () => {
    expect(
      parseDatabaseTarget("postgres://u:p@DB.Example.COM.:5432/x"),
    ).toEqual({
      host: "db.example.com",
      port: "5432",
      database: "x",
    });
  });

  it("strips IPv6 brackets for the token", () => {
    expect(parseDatabaseTarget("postgresql://u:p@[::1]:5432/db")).toEqual({
      host: "::1",
      port: "5432",
      database: "db",
    });
  });

  it("decodes a percent-escaped authority the way pg resolves it", () => {
    expect(
      parseDatabaseTarget("postgresql://u:p@%65xample.com:5432/db"),
    ).toEqual({ host: "example.com", port: "5432", database: "db" });
  });

  it("ignores non-identity query parameters when resolving the target", () => {
    expect(
      parseDatabaseTarget(
        "postgresql://u:p@db.example.com:5432/app?sslmode=disable&application_name=migrator",
      ),
    ).toEqual({ host: "db.example.com", port: "5432", database: "app" });
  });

  // pg-connection-string folds search params into the resolved config before
  // the URL authority, so each of these would silently redirect the pg target
  // the confirmation token claims to bind.
  it.each([
    "postgresql://u:p@db.example.com:5432/app?host=other.internal",
    "postgresql://u:p@db.example.com:5432/app?host=",
    "postgresql://u:p@db.example.com:5432/app?port=9999",
    "postgresql://u:p@db.example.com:5432/app?database=other",
    "postgresql://u:p@db.example.com:5432/app?user=postgres",
    "postgresql://u:p@db.example.com:5432/app?password=leaked",
    "postgresql://u:p@db.example.com:5432/app?host=/var/run/postgresql",
    "postgresql://u:p@db.example.com:5432/app?sslmode=disable&host=other",
  ])("refuses identity-overriding query parameters: %s", (url) => {
    expect(() => parseDatabaseTarget(url)).toThrow(MigratorConfigError);
    expect(() => parseDatabaseTarget(url)).toThrow(/override/u);
  });

  it("refuses non-postgres protocols", () => {
    expect(() => parseDatabaseTarget("http://localhost:5432/db")).toThrow(
      MigratorConfigError,
    );
    expect(() => parseDatabaseTarget("mysql://localhost:5432/db")).toThrow(
      MigratorConfigError,
    );
  });

  it("refuses unparseable URLs and empty database names", () => {
    expect(() => parseDatabaseTarget("not-a-url")).toThrow(MigratorConfigError);
    expect(() =>
      parseDatabaseTarget("postgresql://u:p@localhost:5432/"),
    ).toThrow(MigratorConfigError);
    expect(() =>
      parseDatabaseTarget("postgresql://u:p@localhost:5432"),
    ).toThrow(MigratorConfigError);
  });
});

describe("confirmationToken", () => {
  it("formats the resolved target as host|port|database", () => {
    expect(
      confirmationToken({
        host: "postgres",
        port: "5432",
        database: "customreport_prod",
      }),
    ).toBe("postgres|5432|customreport_prod");
  });
});
