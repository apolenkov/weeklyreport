import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { test } from "vitest";
import { parseAllDocuments } from "yaml";

// Local development dependencies run in the OrbStack Kubernetes namespace
// wr-dev; production is the Helm chart.
const read = (path: string): string => readFileSync(resolve(path), "utf8");
const depsPath = "deploy/local-dev/deps.yaml";
const depsContent = read(depsPath);
const rootPackage = JSON.parse(read("package.json")) as {
  readonly scripts?: Readonly<Record<string, string>>;
};
const turboConfig = JSON.parse(read("turbo.json")) as {
  readonly tasks?: Readonly<
    Record<string, { readonly env?: readonly string[] }>
  >;
};

interface EnvEntry {
  readonly name: string;
  readonly value?: string;
}
interface Container {
  readonly name: string;
  readonly image: string;
  readonly args?: readonly string[];
  readonly env?: readonly EnvEntry[];
  readonly resources?: { readonly limits?: { readonly memory?: string } };
}
interface Manifest {
  readonly kind: string;
  readonly metadata: { readonly name: string };
  readonly spec: {
    readonly type?: string;
    readonly ports?: readonly { readonly port: number }[];
    readonly template?: { readonly spec: { readonly containers: Container[] } };
  };
}

const manifests = parseAllDocuments(depsContent).map(
  (document) => document.toJS() as Manifest,
);

function container(name: string): Container {
  const workload = manifests.find(
    (manifest) =>
      ["Deployment", "StatefulSet"].includes(manifest.kind) &&
      manifest.metadata.name === name,
  );
  const found = workload?.spec.template?.spec.containers[0];
  assert.ok(found, `${depsPath} must define workload ${name}`);
  return found;
}

function envOf(name: string): Readonly<Record<string, string | undefined>> {
  return Object.fromEntries(
    (container(name).env ?? []).map((entry) => [entry.name, entry.value]),
  );
}

test("local dependencies publish exactly the documented localhost ports", () => {
  const published = manifests
    .filter((manifest) => manifest.kind === "Service")
    .map((manifest) => ({
      name: manifest.metadata.name,
      type: manifest.spec.type,
      ports: (manifest.spec.ports ?? []).map(({ port }) => port),
    }));
  // OrbStack exposes LoadBalancer Services on localhost only.
  assert.deepEqual(published, [
    { name: "postgres", type: "LoadBalancer", ports: [5432] },
    { name: "redis", type: "LoadBalancer", ports: [6379] },
    { name: "mailpit", type: "LoadBalancer", ports: [1025, 8025] },
    { name: "gotenberg", type: "LoadBalancer", ports: [3010] },
  ]);
});

test("local PostgreSQL owns one exact guarded database target", () => {
  const env = envOf("postgres");
  assert.equal(env.POSTGRES_USER, "customreport");
  assert.equal(env.POSTGRES_PASSWORD, "localdev");
  assert.equal(env.POSTGRES_DB, "customreport_e2e");
  assert.deepEqual(container("postgres").args, [
    "-c",
    "shared_preload_libraries=pg_stat_statements",
    "-c",
    "pg_stat_statements.track=all",
    "-c",
    "pg_stat_statements.max=10000",
    "-c",
    "log_min_duration_statement=200",
  ]);
  assert.match(
    depsContent,
    /command: \[pg_isready, -U, customreport, -d, postgres\]/u,
  );
});

test("local Redis keeps the capped noeviction contract", () => {
  assert.deepEqual(container("redis").args, [
    "redis-server",
    "--maxmemory-policy",
    "noeviction",
    "--maxmemory",
    "200mb",
    "--appendonly",
    "yes",
  ]);
});

test("the local renderer is bounded, isolated and reaches only the host web", () => {
  const renderer = container("gotenberg");
  assert.equal(renderer.resources?.limits?.memory, "1Gi");
  assert.deepEqual(envOf("gotenberg"), {
    API_TIMEOUT: "150s",
    CHROMIUM_MAX_CONCURRENCY: "1",
    CHROMIUM_CLEAR_COOKIES: "true",
    CHROMIUM_CLEAR_STORAGE: "true",
    CHROMIUM_CLEAR_CACHE: "true",
    CHROMIUM_ALLOW_LIST: String.raw`^http://host\.internal:[0-9]+/`,
    CHROMIUM_DENY_PRIVATE_IPS: "false",
    CHROMIUM_DENY_PUBLIC_IPS: "true",
  });
});

test("the environment example points native processes at the local dependencies", () => {
  const example = read(".env.example");
  assert.match(example, /^GOTENBERG_URL=http:\/\/localhost:3010$/mu);
  assert.match(example, /^PDF_BASE_URL=http:\/\/host\.internal:3000$/mu);
  assert.match(example, /^SMTP_PORT=1025$/mu);
  assert.match(example, /^REDIS_PORT=6379$/mu);
  assert.match(example, /^OTEL_SDK_DISABLED=true$/mu);
});

test("dependency scripts replace the retired Compose lanes", () => {
  const scripts = rootPackage.scripts ?? {};
  assert.equal(scripts["deps:up"], "bash deploy/local-dev/up.sh");
  assert.equal(scripts["deps:down"], "bash deploy/local-dev/down.sh");
  for (const retired of [
    "dev:watch",
    "db:reset:hard:docker",
    "observability:compose",
    "observability:up",
    "observability:down",
    "observability:logs",
  ]) {
    assert.equal(scripts[retired], undefined, `${retired} must stay retired`);
  }
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

for (const entrypoint of ["up.sh", "down.sh"]) {
  test(`${entrypoint} admits only the declared OrbStack context and pins every operation`, () => {
    mkdirSync(resolve("output"), { recursive: true });
    const fixture = mkdtempSync(resolve("output/d37-v09-local-dev-"));
    const log = join(fixture, "kubectl.jsonl");
    const kubectl = join(fixture, "kubectl");
    writeFileSync(
      kubectl,
      String.raw`#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$WR_TEST_KUBECTL_LOG"
if [ "$*" = 'config current-context' ]; then
  printf '%s\n' "$WR_TEST_CONTEXT"
fi
`,
      { mode: 0o700 },
    );
    const execute = (context: string) =>
      spawnSync("/bin/bash", [resolve("deploy/local-dev", entrypoint)], {
        encoding: "utf8",
        timeout: 2000,
        env: {
          ...process.env,
          PATH: `${fixture}:${process.env.PATH ?? ""}`,
          KUBECONFIG: "/dev/null",
          WR_TEST_KUBECTL_LOG: log,
          WR_TEST_CONTEXT: context,
        },
      });
    try {
      const denied = execute("shared-staging");
      assert.notEqual(denied.status, 0, "foreign context must be refused");
      const deniedCalls = readFileSync(log, "utf8").trim().split("\n");
      assert.deepEqual(deniedCalls, ["config current-context"]);

      writeFileSync(log, "");
      const allowed = execute("orbstack");
      assert.equal(allowed.status, 0, allowed.stderr);
      const allowedCalls = readFileSync(log, "utf8").trim().split("\n");
      assert.equal(allowedCalls[0], "config current-context");
      assert.ok(
        allowedCalls.length > 1,
        "control must execute dependency operations",
      );
      for (const argv of allowedCalls.slice(1)) {
        assert.match(argv, /^--context=orbstack /u);
      }
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}
