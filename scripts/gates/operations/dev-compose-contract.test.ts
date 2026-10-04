import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "vitest";
import { parse } from "yaml";

import { REQUIRED_REPORT_ASSISTANT_ENV_KEYS } from "../../../apps/api/src/infrastructure/config/report-assistant-env-keys.ts";

// Development and local observability remain supported independently of Helm.
const read = (path: string): string => readFileSync(resolve(path), "utf8");
const devCompose = "docker-compose.yml";
const devContent = read(devCompose);
const devOverrideContent = read("docker-compose.dev.yml");
const errorsContent = read("docker-compose.errors.yml");
const rootPackage = JSON.parse(read("package.json")) as {
  readonly scripts?: Readonly<Record<string, string>>;
};
const turboConfig = JSON.parse(read("turbo.json")) as {
  readonly tasks?: Readonly<
    Record<string, { readonly env?: readonly string[] }>
  >;
};
const DEV_APP_DATABASE_URL =
  "postgresql://customreport:localdev@postgres:5432/customreport_e2e";
const DEV_APP_DATABASE_ASSIGNMENT_COUNT = 2;

test("development Compose owns one exact guarded database target", () => {
  assert.doesNotMatch(
    devContent,
    /\$\{DB_PASSWORD/u,
    `${devCompose} must not interpolate DB_PASSWORD`,
  );
  assert.doesNotMatch(devContent, /postgresql:\/\/customreport:\$\{/u);
  assert.match(devContent, /POSTGRES_PASSWORD: localdev/u);
  assert.match(devContent, /POSTGRES_DB: customreport_e2e/u);
  assert.match(devContent, /pg_isready -U customreport -d postgres/u);
  const applicationDatabaseUrls = devContent
    .split("\n")
    .map((line) => line.trim())
    .flatMap((line) => {
      for (const key of ["DATABASE_URL: "]) {
        if (line.startsWith(key)) return [line.slice(key.length)];
      }
      return [];
    });
  assert.equal(
    applicationDatabaseUrls.length,
    DEV_APP_DATABASE_ASSIGNMENT_COUNT,
  );
  assert.deepEqual(
    new Set(applicationDatabaseUrls),
    new Set([DEV_APP_DATABASE_URL]),
  );
});

test("development API watches the current persistence source", () => {
  assert.match(
    devOverrideContent,
    /- \.\/packages\/report-persistence\/src:\/app\/packages\/report-persistence\/src/u,
  );
  assert.match(
    devOverrideContent,
    /action: restart\n\s+path: \.\/packages\/report-persistence\/src/u,
  );
});

test("Turbo forwards dev auth and product feedback switches", () => {
  const devEnv = turboConfig.tasks?.dev?.env ?? [];
  assert.ok(devEnv.includes("AUTH_DEV_MODE"));
  assert.ok(devEnv.includes("NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED"));
  assert.ok(devEnv.includes("NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES"));
  assert.ok(devEnv.includes("PRODUCT_FEEDBACK_ENABLED"));
});

test("feedback dev contour enables role switching and admin inbox", () => {
  const command = rootPackage.scripts?.["dev:feedback"];
  assert.ok(command, "package.json must expose dev:feedback");
  assert.match(command, /AUTH_DEV_MODE=true/u);
  assert.match(command, /NEXT_PUBLIC_DEV_ROLE_SWITCHER=true/u);
  assert.match(command, /PRODUCT_FEEDBACK_ENABLED=true/u);
  assert.match(command, /NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED=true/u);
  assert.match(command, /NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES=admin/u);
  assert.match(command, /turbo run dev/u);
});

test("Bugsink persists its SQLite database in the named data volume", () => {
  const model = parse(errorsContent, { maxAliasCount: 50 }) as {
    readonly services?: Readonly<
      Record<
        string,
        {
          readonly environment?: Readonly<Record<string, unknown>>;
          readonly volumes?: readonly string[];
        }
      >
    >;
  };
  const bugsink = model.services?.bugsink;
  const volumes = bugsink?.volumes ?? [];
  assert.ok(volumes.includes("bugsinkdata:/data"));
  assert.ok(!volumes.some((volume) => volume.endsWith(":/app/data")));
  assert.equal(bugsink?.environment?.SINGLE_USER, "true");
  assert.ok(
    !("BUGSINK_SINGLE_USER_MODE" in bugsink.environment),
    "Bugsink must use the exact upstream single-user setting",
  );
});

interface ComposeService {
  readonly command?: readonly string[];
  readonly environment?: Readonly<Record<string, unknown>>;
  readonly ports?: readonly string[];
  readonly depends_on?: Readonly<Record<string, unknown>> | readonly string[];
  readonly healthcheck?: { readonly test?: unknown };
  readonly deploy?: {
    readonly resources?: { readonly limits?: { readonly memory?: string } };
  };
}

function services(source: string): Readonly<Record<string, ComposeService>> {
  return (
    parse(source, { maxAliasCount: 50 }) as {
      readonly services: Readonly<Record<string, ComposeService>>;
    }
  ).services;
}

function assertLoopbackPorts(source: string, path: string): string[] {
  const ports = Object.values(services(source)).flatMap(
    (service) => service.ports ?? [],
  );
  assert.ok(ports.length > 0, `${path} must publish its local ports`);
  for (const port of ports) {
    assert.match(
      port,
      /^127\.0\.0\.1:(?:\d+|\$\{[A-Z_]+:-\d+\}):\d+$/u,
      `${path} must bind ${port} explicitly to loopback`,
    );
  }
  return ports;
}

test("all development and local observability host ports bind to loopback", () => {
  assert.deepEqual(assertLoopbackPorts(devContent, devCompose), [
    "127.0.0.1:5432:5432",
    "127.0.0.1:1025:1025",
    "127.0.0.1:8025:8025",
    "127.0.0.1:6379:6379",
    "127.0.0.1:3002:3002",
    "127.0.0.1:3000:3000",
  ]);
  for (const path of [
    "docker-compose.dev.yml",
    "docker-compose.observability.yml",
    "docker-compose.errors.yml",
  ]) {
    assertLoopbackPorts(read(path), path);
  }
});

test("development port guard rejects a planted wildcard binding", () => {
  const planted = devContent.replace('"127.0.0.1:6379:6379"', '"6379:6379"');
  assert.notEqual(planted, devContent);
  assert.throws(
    () => assertLoopbackPorts(planted, "planted"),
    /must bind 6379:6379 explicitly to loopback/,
  );
});

test("local migration starts the installed Prisma binary", () => {
  assert.deepEqual(services(devContent).migrate?.command, [
    "./node_modules/.bin/prisma",
    "migrate",
    "deploy",
  ]);
});

test("both local API definitions supply the assistant policy and deny outbound data", () => {
  for (const source of [devContent, devOverrideContent]) {
    const env = services(source).api?.environment;
    assert.ok(env);
    for (const key of REQUIRED_REPORT_ASSISTANT_ENV_KEYS) {
      assert.notEqual(env[key], undefined, `${key} must be supplied`);
      assert.notEqual(String(env[key]), "", `${key} must not be blank`);
      if (String(env[key]).startsWith("${")) {
        assert.ok(
          String(env[key]).startsWith(`\${${key}:?`),
          `${key} must fail closed`,
        );
      }
    }
    assert.equal(env.REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED, "false");
  }
});

test("the local renderer is bounded, isolated and independent of API startup", () => {
  const base = services(devContent);
  const renderer = base.gotenberg;
  assert.ok(renderer);
  assert.equal(renderer.ports, undefined);
  assert.equal(renderer.deploy?.resources?.limits?.memory, "1G");
  assert.match(
    JSON.stringify(renderer.healthcheck),
    /curl .*http:\/\/127\.0\.0\.1:3000\/health/u,
  );
  assert.deepEqual(renderer.environment, {
    API_TIMEOUT: "150s",
    CHROMIUM_MAX_CONCURRENCY: 1,
    CHROMIUM_CLEAR_COOKIES: "true",
    CHROMIUM_CLEAR_STORAGE: "true",
    CHROMIUM_CLEAR_CACHE: "true",
    CHROMIUM_ALLOW_LIST: "^http://web:3000/",
    CHROMIUM_DENY_PRIVATE_IPS: "true",
    CHROMIUM_DENY_PUBLIC_IPS: "true",
  });
  const overlay = services(devOverrideContent);
  assert.deepEqual(overlay.gotenberg, {
    environment: { CHROMIUM_ALLOW_LIST: "^http://web:3000/" },
  });
  for (const definitions of [base, overlay]) {
    assert.equal(
      definitions.api?.environment?.GOTENBERG_URL,
      "http://gotenberg:3000",
    );
    assert.equal(definitions.api.environment.PDF_BASE_URL, "http://web:3000");
    const dependencies = definitions.api.depends_on ?? {};
    assert.ok(
      !(
        Array.isArray(dependencies) ? dependencies : Object.keys(dependencies)
      ).includes("gotenberg"),
    );
  }
});
