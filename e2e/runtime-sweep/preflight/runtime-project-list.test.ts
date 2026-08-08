import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, test } from "vitest";

import {
  runtimeApiServerCommand,
  runtimeApiServerCwd,
} from "../../runtime-api-server-command.ts";

const SOURCE_SHA = "a".repeat(40);
const ENV_KEYS = [
  "E2E_DATABASE_URL",
  "E2E_WEB_PORT",
  "LOG_LEVEL",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_SERVICE_NAME",
  "OTEL_SERVICE_VERSION",
  "RUNTIME_SWEEP_BUGSINK_DSN",
  "RUNTIME_SWEEP_ARCHIVE",
  "RUNTIME_SWEEP_PROFILE",
  "RUNTIME_SWEEP_SOURCE_SHA",
] as const;

const configureRuntimeEnvironment = (archive: string): void => {
  Object.assign(process.env, {
    E2E_DATABASE_URL: "postgresql://localhost/customreport_e2e",
    E2E_WEB_PORT: "3105",
    LOG_LEVEL: "info",
    OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:4318",
    OTEL_SERVICE_NAME: "customreport-api-runtime-test",
    OTEL_SERVICE_VERSION: SOURCE_SHA,
    RUNTIME_SWEEP_BUGSINK_DSN: "http://runtime@127.0.0.1:8000/1",
    RUNTIME_SWEEP_ARCHIVE: archive,
    RUNTIME_SWEEP_PROFILE: "full",
    RUNTIME_SWEEP_SOURCE_SHA: SOURCE_SHA,
  });
};

const clearRuntimeEnvironment = (): void =>
  ENV_KEYS.forEach((key) => delete process.env[key]);

const requiredWebServers = (
  config: typeof import("./playwright.config.ts").default,
) => {
  const webServers = config.webServer;
  if (!Array.isArray(webServers)) throw new Error("web servers missing");
  return webServers;
};

const assertProjectChain = (
  config: typeof import("./playwright.config.ts").default,
): void => {
  expect(config.testDir).toBe(path.resolve(import.meta.dirname, ".."));
  const configured = config.projects ?? [];
  expect(configured.map(({ name }) => name)).toEqual([
    "runtime-prerequisites",
    "runtime-baseline",
    "runtime-matrix",
    "runtime-live-controls",
  ]);
  expect(configured.map(({ dependencies }) => dependencies ?? [])).toEqual([
    [],
    ["runtime-prerequisites"],
    ["runtime-baseline"],
    ["runtime-matrix"],
  ]);
  expect(configured.map(({ use }) => use?.viewport)).toEqual(
    Array.from({ length: 4 }, () => ({ width: 1440, height: 900 })),
  );
};

const assertRuntimeServers = (
  config: typeof import("./playwright.config.ts").default,
  archive: string,
): void => {
  const webServers = requiredWebServers(config);
  expect(webServers[0]?.env?.LOG_DIR).toBe(
    path.join(archive, "api-log", "full"),
  );
  expect(webServers[0]?.env?.PDF_OUTPUT_DIR).toBe(
    path.join(archive, "pdfs", "full"),
  );
  ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"].forEach(
    (key) => expect(webServers[0]?.env).not.toHaveProperty(key),
  );
  expect(webServers[1]?.cwd).toBe(
    path.resolve(import.meta.dirname, "..", "..", ".."),
  );
  expect(webServers[1]?.command).toBe(
    "pnpm exec tsx e2e/runtime-sweep/preflight/run-runtime-next-server.ts sweep 3105",
  );
};

test("keeps deterministic runtime projects in dependency order", async () => {
  const archive = await mkdtemp(
    path.join(os.tmpdir(), "runtime-project-list-"),
  );
  try {
    configureRuntimeEnvironment(archive);
    const { default: config } = await import("./playwright.config.ts");
    assertProjectChain(config);
    assertRuntimeServers(config, archive);

    const { default: preflightConfig } =
      await import("./playwright.preflight.config.ts");
    const preflightServers = preflightConfig.webServer;
    if (!Array.isArray(preflightServers))
      throw new Error("preflight web servers missing");
    expect(preflightServers[0]?.command).toBe(runtimeApiServerCommand);
    expect(preflightServers[0]?.cwd).toBe(runtimeApiServerCwd);
    expect(preflightServers[0]?.env?.LOG_DIR).toBe(
      path.join(archive, "api-log", "preflight"),
    );
    expect(preflightServers[0]?.env?.LOG_LEVEL).toBe("info");
    expect(preflightServers[0]?.gracefulShutdown).toEqual({
      signal: "SIGTERM",
      timeout: 10_000,
    });
    expect(preflightServers[1]?.cwd).toBe(
      path.resolve(import.meta.dirname, "..", "..", ".."),
    );
    expect(preflightServers[1]?.command).toBe(
      "pnpm exec tsx e2e/runtime-sweep/preflight/run-runtime-next-server.ts preflight 3105",
    );
  } finally {
    clearRuntimeEnvironment();
    await rm(archive, { recursive: true, force: true });
  }
});
