import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import test from "node:test";

const prodCompose = resolve("docker-compose.prod.yml");

function resolveExecutable(command: string): string {
  const searchPath = process.env.PATH;
  if (searchPath === undefined) {
    throw new Error(`PATH is required to resolve ${command}`);
  }
  const executable = searchPath
    .split(delimiter)
    .map((directory) => join(directory, command))
    .find(existsSync);
  if (executable === undefined) {
    throw new Error(`${command} is required for the production compose gate`);
  }
  return executable;
}

interface ComposeCommand {
  readonly executable: string;
  readonly leadingArguments: readonly string[];
}

const resolveComposeCommand = (): ComposeCommand => {
  try {
    return {
      executable: resolveExecutable("docker-compose"),
      leadingArguments: [],
    };
  } catch {
    return {
      executable: resolveExecutable("docker"),
      leadingArguments: ["compose"],
    };
  }
};

const composeCommand = resolveComposeCommand();

// Operational policy inputs that docker-compose.prod.yml must require with
// `${VAR:?...}` — a `:-` silent default here would invent resource,
// observability, or edge policy a deploy never chose.
const REQUIRED_POLICY_INPUTS = [
  "DB_PASSWORD",
  "PGBOUNCER_MAX_CLIENT_CONN",
  "PGBOUNCER_POOL_SIZE",
  "PGBOUNCER_RESERVE_POOL_SIZE",
  "BACKUP_INTERVAL_SECONDS",
  "BACKUP_RETENTION_DAYS",
  "FRONTEND_URL",
  "APP_BASE_URL",
  "AUTH_JWT_SECRET",
  "PDF_EXPORT_JWT_SECRET",
  "PDF_BASE_URL",
  "LOG_LEVEL",
  "REDIS_DB",
  "OTEL_SDK_DISABLED",
  "OTEL_TRACES_SAMPLER_ARG",
  "HEAP_HEALTH_THRESHOLD_BYTES",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_FROM",
  "KEYCLOAK_SAML_CALLBACK_URL",
  "KEYCLOAK_SAML_ENTRY_POINT",
  "KEYCLOAK_SAML_ISSUER",
  "KEYCLOAK_SAML_CERT",
  "NEXT_PUBLIC_API_URL",
  "API_URL",
  "CADDY_SITE_ADDRESS",
  "CADDY_CSP_REPORT_URI",
  "HTTP_PORT",
  "HTTPS_PORT",
  "HTTPS_PORT_QUIC",
] as const;

const content = readFileSync(prodCompose, "utf8");

void test("production compose requires every operational policy input", () => {
  for (const variable of REQUIRED_POLICY_INPUTS) {
    // The `:?` guard must name the variable explicitly (a compose render with
    // the variable blank fails instead of inventing a default).
    assert.ok(
      content.includes(`\${${variable}:?`),
      `${variable} must be required with \${${variable}:?...} in ${prodCompose}`,
    );
  }
});

void test("production compose has no silent `:-` defaults on policy inputs", () => {
  for (const variable of REQUIRED_POLICY_INPUTS) {
    assert.ok(
      !content.includes(`\${${variable}:-`),
      `${variable} must not carry a silent \`:-\` default in ${prodCompose}`,
    );
  }
});

// A real render check: with the policy matrix supplied the model renders;
// with every required var blank it must fail to render.
const renderCompose = (env: NodeJS.ProcessEnv) =>
  spawnSync(
    composeCommand.executable,
    [...composeCommand.leadingArguments, "-f", prodCompose, "config"],
    {
      env,
      encoding: "utf8",
    },
  );

const FULL_POLICY_ENV: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  DB_PASSWORD: "x",
  FRONTEND_URL: "http://x",
  APP_BASE_URL: "http://x",
  NEXT_PUBLIC_API_URL: "http://x",
  API_URL: "http://api:3001",
  AUTH_JWT_SECRET: "x".repeat(32),
  PDF_EXPORT_JWT_SECRET: "x".repeat(32),
  PDF_BASE_URL: "http://x",
  HEAP_HEALTH_THRESHOLD_BYTES: "1610612736",
  SMTP_HOST: "x",
  SMTP_PORT: "587",
  SMTP_FROM: "x",
  KEYCLOAK_SAML_CALLBACK_URL: "http://x",
  KEYCLOAK_SAML_ENTRY_POINT: "http://x",
  KEYCLOAK_SAML_ISSUER: "x",
  KEYCLOAK_SAML_CERT: "x",
  CADDY_SITE_ADDRESS: "http://x",
  CADDY_CSP_REPORT_URI: "http://x",
  BACKUP_INTERVAL_SECONDS: "3600",
  BACKUP_RETENTION_DAYS: "14",
  PGBOUNCER_MAX_CLIENT_CONN: "100",
  PGBOUNCER_POOL_SIZE: "20",
  PGBOUNCER_RESERVE_POOL_SIZE: "5",
  LOG_LEVEL: "info",
  REDIS_DB: "0",
  OTEL_SDK_DISABLED: "true",
  OTEL_TRACES_SAMPLER_ARG: "0",
  HTTP_PORT: "80",
  HTTPS_PORT: "443",
  HTTPS_PORT_QUIC: "443",
};

void test("production compose renders with the full policy matrix", () => {
  const rendered = renderCompose(FULL_POLICY_ENV);
  assert.equal(rendered.status, 0, rendered.stderr);
});

void test("production compose refuses to render with a blank required input", () => {
  // Blank every required var: compose must exit nonzero instead of inventing
  // operational policy. A handful are exempted as documented optional
  // integrations (OTEL_EXPORTER_OTLP_ENDPOINT, SMTP_USER/PASS, SENTRY_DSN,
  // FRONTEND_URLS, OTEL_SERVICE_VERSION, CLIENT_LOG_FORWARDING, CADDY_ACME_EMAIL).
  const blanked = renderCompose({ PATH: process.env.PATH });
  assert.notEqual(blanked.status, 0);
  assert.match(`${blanked.stdout}${blanked.stderr}`, /required|must be set/i);
});
