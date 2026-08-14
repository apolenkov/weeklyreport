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
  "PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION",
  "E2E_API_PORT",
  "E2E_WEB_PORT",
  "LOG_LEVEL",
  "NEXT_PUBLIC_API_URL",
  "NO_PROXY",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_SDK_DISABLED",
  "OTEL_TRACES_SAMPLER_ARG",
  "OTEL_SERVICE_NAME",
  "OTEL_SERVICE_VERSION",
  "RUNTIME_SWEEP_BUGSINK_DSN",
  "RUNTIME_SWEEP_ARCHIVE",
  "RUNTIME_SWEEP_BASE_URL",
  "RUNTIME_SWEEP_PREFLIGHT_MODE",
  "RUNTIME_SWEEP_PROFILE",
  "RUNTIME_SWEEP_SOURCE_SHA",
  "no_proxy",
] as const;

type RuntimeEnvironmentSnapshot = Readonly<
  Record<(typeof ENV_KEYS)[number], string | undefined>
>;

const configureRuntimeEnvironment = (archive: string): void => {
  Object.assign(process.env, {
    E2E_DATABASE_URL: "postgresql://localhost/customreport_e2e",
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
    E2E_WEB_PORT: "3105",
    LOG_LEVEL: "info",
    OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:4318",
    OTEL_SDK_DISABLED: "true",
    OTEL_TRACES_SAMPLER_ARG: "0",
    OTEL_SERVICE_NAME: "customreport-api-runtime-test",
    OTEL_SERVICE_VERSION: SOURCE_SHA,
    RUNTIME_SWEEP_BUGSINK_DSN: "http://runtime@127.0.0.1:8000/1",
    RUNTIME_SWEEP_ARCHIVE: archive,
    RUNTIME_SWEEP_PROFILE: "full",
    RUNTIME_SWEEP_PREFLIGHT_MODE: "full",
    RUNTIME_SWEEP_SOURCE_SHA: SOURCE_SHA,
  });
};

const snapshotRuntimeEnvironment = (): RuntimeEnvironmentSnapshot =>
  Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  ) as RuntimeEnvironmentSnapshot;

const restoreRuntimeEnvironment = (
  snapshot: RuntimeEnvironmentSnapshot,
): void =>
  ENV_KEYS.forEach((key) => {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
      return;
    }
    process.env[key] = value;
  });

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
  expect(webServers[0]?.command).toBe(runtimeApiServerCommand);
  expect(webServers[0]?.cwd).toBe(runtimeApiServerCwd);
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
  const environmentSnapshot = snapshotRuntimeEnvironment();
  try {
    configureRuntimeEnvironment(archive);
    const { default: config } = await import("./playwright.config.ts");
    assertProjectChain(config);
    assertRuntimeServers(config, archive);
    const runtimeServers = requiredWebServers(config);

    const { default: preflightConfig } =
      await import("./playwright.preflight.config.ts");
    const { default: integrationConfig } =
      await import("../../playwright.integration.config.ts");
    const integrationServers = integrationConfig.webServer;
    if (!Array.isArray(integrationServers))
      throw new Error("integration web servers missing");
    expect(integrationServers[0]?.env?.OTEL_SDK_DISABLED).toBe("true");
    expect(integrationServers[0]?.env?.OTEL_TRACES_SAMPLER_ARG).toBe("0");
    expect(runtimeServers[0]?.env?.OTEL_SDK_DISABLED).toBe("false");
    expect(runtimeServers[0]?.env?.OTEL_TRACES_SAMPLER_ARG).toBe("1");
    const preflightServers = preflightConfig.webServer;
    if (!Array.isArray(preflightServers))
      throw new Error("preflight web servers missing");
    expect(preflightConfig.globalSetup).toBeUndefined();
    expect(preflightConfig.globalTeardown).toBeUndefined();
    expect(preflightConfig.testDir).toBe(import.meta.dirname);
    expect(preflightConfig.testMatch).toEqual(/preflight\.spec\.ts/);
    expect(preflightConfig.projects?.map(({ name }) => name)).toEqual([
      "runtime-preflight",
    ]);
    expect(preflightConfig.projects?.[0]?.use?.viewport).toEqual({
      width: 1440,
      height: 900,
    });
    expect(preflightServers[0]?.command).toBe(runtimeApiServerCommand);
    expect(preflightServers[0]?.cwd).toBe(runtimeApiServerCwd);
    expect(preflightServers[0]?.env?.LOG_DIR).toBe(
      path.join(archive, "api-log", "preflight"),
    );
    expect(preflightServers[0]?.env?.LOG_LEVEL).toBe("info");
    expect(preflightServers[0]?.env?.OTEL_SDK_DISABLED).toBe("false");
    expect(preflightServers[0]?.env?.OTEL_TRACES_SAMPLER_ARG).toBe("1");
    expect(preflightServers[0]?.env?.OTEL_EXPORTER_OTLP_ENDPOINT).toBe(
      "http://127.0.0.1:4318",
    );
    expect(preflightServers[0]?.env?.OTEL_SERVICE_NAME).toBe(
      "customreport-api-runtime-test",
    );
    expect(preflightServers[0]?.env?.OTEL_SERVICE_VERSION).toBe(SOURCE_SHA);
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
    restoreRuntimeEnvironment(environmentSnapshot);
    await rm(archive, { recursive: true, force: true });
  }
  expect(snapshotRuntimeEnvironment()).toEqual(environmentSnapshot);
});

test("registers focused observability and submit harness specs", async () => {
  const { default: config } = await import("./playwright.harness.config.ts");
  const configured = config.testMatch;
  const patterns = Array.isArray(configured) ? configured : [configured];
  const matches = (file: string): boolean =>
    patterns.some((pattern) => pattern instanceof RegExp && pattern.test(file));

  expect(matches("replay/control-actions/submit.spec.ts")).toBe(true);
  expect(matches("evidence/capture/observability-abort.spec.ts")).toBe(true);
  expect(matches("replay/browser-state/client-storage.spec.ts")).toBe(true);
  expect(matches("matrix/specialized-observability.spec.ts")).toBe(false);
});
