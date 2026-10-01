import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { test } from "vitest";
import { parse } from "yaml";

import {
  chartDirectory,
  mainContainer,
  renderExample,
} from "./helm-chart-render.ts";

const composeSource = readFileSync(resolve("docker-compose.prod.yml"), "utf8");

interface ComposeModel {
  readonly services: Readonly<
    Record<
      string,
      {
        readonly image?: string;
        readonly environment?: Record<string, unknown>;
      }
    >
  >;
}

const compose = parse(composeSource, { maxAliasCount: 50 }) as ComposeModel;

interface SchemaNode {
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, SchemaNode>>;
}

interface ChartSchema extends SchemaNode {
  readonly properties: Readonly<Record<string, SchemaNode>> & {
    readonly api: SchemaNode;
  };
}

const schema = JSON.parse(
  readFileSync(join(chartDirectory, "values.schema.json"), "utf8"),
) as ChartSchema;

/** Compose `${VAR:?}` inputs the chart derives or does not need. */
const DERIVED_OR_UNNEEDED_INPUTS = new Set([
  "HTTP_PORT",
  "HTTPS_PORT",
  "HTTPS_PORT_QUIC",
  "CADDY_SITE_ADDRESS",
  "CADDY_ACME_EMAIL",
  "BACKUP_INTERVAL_SECONDS",
  "PDF_BASE_URL",
  "CHROMIUM_ALLOW_LIST",
  "GOTENBERG_URL",
  "OTEL_SERVICE_VERSION",
  // Web image build arguments: set by the CI image job, not chart values.
  "NEXT_PUBLIC_CLIENT_LOG_FORWARDING",
  "NEXT_PUBLIC_WEB_VITALS",
  "NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED",
  "NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES",
]);

/** Compose inputs whose chart value does not share the environment name. */
const RENAMED_INPUTS: ReadonlyMap<string, string> = new Map([
  ["POSTGRES_DB", "postgres.db"],
  ["PGBOUNCER_MAX_CLIENT_CONN", "pgbouncer.maxClientConn"],
  ["PGBOUNCER_POOL_SIZE", "pgbouncer.poolSize"],
  ["PGBOUNCER_RESERVE_POOL_SIZE", "pgbouncer.reservePoolSize"],
  ["BACKUP_RETENTION_DAYS", "backup.retentionDays"],
  ["CADDY_CSP_REPORT_URI", "edge.cspReportUri"],
  ...[
    "DB_PASSWORD",
    "AUTH_JWT_SECRET",
    "PDF_EXPORT_JWT_SECRET",
    "AI_PROVIDER_CONFIG_ENCRYPTION_KEY",
  ].map((key): [string, string] => [key, `secrets.values.${key}`]),
]);

/** Api environment names only the chart sets: DATABASE_URL is built from it. */
const CHART_ONLY_API_KEYS = new Set(["DB_PASSWORD"]);

function requiredPaths(node: SchemaNode, prefix: string): string[] {
  return (node.required ?? []).flatMap((key) => {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    return [path, ...requiredPaths(node.properties?.[key] ?? {}, path)];
  });
}

function declaredPaths(node: SchemaNode, prefix: string): string[] {
  return Object.entries(node.properties ?? {}).flatMap(([key, child]) => {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    return [path, ...declaredPaths(child, path)];
  });
}

function thirdPartyDigests(images: readonly (string | undefined)[]): string[] {
  return images
    .map((image) => image?.match(/@sha256:[0-9a-f]{64}$/)?.[0] ?? "")
    .sort();
}

test("third-party image digests match compose", () => {
  const values = parse(
    readFileSync(join(chartDirectory, "values.yaml"), "utf8"),
  ) as { images: { thirdParty: Record<string, string> } };
  const pairs: readonly [string, string][] = [
    ["postgres", "postgres"],
    ["pgbouncer", "pgbouncer"],
    ["redis", "redis"],
    ["caddy", "caddy"],
    ["gotenberg", "gotenberg"],
  ];
  for (const [chartKey, service] of pairs) {
    assert.equal(
      values.images.thirdParty[chartKey],
      compose.services[service]?.image,
      `${chartKey} differs from compose service ${service}`,
    );
  }
  assert.equal(
    Object.keys(values.images.thirdParty).length,
    pairs.length,
    "a third-party image is missing from the comparison",
  );
  assert.ok(
    thirdPartyDigests(Object.values(values.images.thirdParty)).every(Boolean),
  );
});

test("the api environment key set matches compose", () => {
  const { manifests } = renderExample();
  const container = mainContainer(manifests, "Deployment", "api");
  const rendered = new Set(container.env?.map((entry) => entry.name));
  const configured = declaredPaths(schema.properties.api, "")
    .filter((path) => path.startsWith("env."))
    .map((path) => path.slice("env.".length));
  const chartKeys = new Set([...rendered, ...configured]);
  const composeKeys = new Set(
    Object.keys(compose.services.api?.environment ?? {}),
  );
  const missingInChart = [...composeKeys].filter((key) => !chartKeys.has(key));
  const missingInCompose = [...chartKeys].filter(
    (key) => !composeKeys.has(key) && !CHART_ONLY_API_KEYS.has(key),
  );
  assert.deepEqual(
    missingInChart,
    [],
    "compose api keys absent from the chart",
  );
  assert.deepEqual(missingInCompose, [], "chart api keys absent from compose");
});

test("every compose required input is a required chart value or a listed exception", () => {
  const composeInputs = new Set(
    [...composeSource.matchAll(/\$\{([A-Z0-9_]+):\?/g)].map(
      (match) => match[1] ?? "",
    ),
  );
  const required = new Set(requiredPaths(schema, ""));
  const secretKeys = new Set(
    declaredPaths(schema, "").filter((path) =>
      path.startsWith("secrets.values."),
    ),
  );
  for (const input of composeInputs) {
    if (DERIVED_OR_UNNEEDED_INPUTS.has(input)) {
      continue;
    }
    const path = RENAMED_INPUTS.get(input) ?? `api.env.${input}`;
    const known = path.startsWith("secrets.values.")
      ? secretKeys.has(path)
      : required.has(path);
    assert.ok(
      known,
      `${input} is neither a required chart value (${path}) nor a listed exception`,
    );
  }
  for (const exception of DERIVED_OR_UNNEEDED_INPUTS) {
    assert.ok(
      composeInputs.has(exception),
      `${exception} is no longer a compose input`,
    );
  }
});
