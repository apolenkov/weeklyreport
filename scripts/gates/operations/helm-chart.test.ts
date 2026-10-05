import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "vitest";

import { REQUIRED_REPORT_ASSISTANT_ENV_KEYS } from "../../../apps/api/src/infrastructure/config/report-assistant-env-keys.ts";
import {
  chartDirectory,
  type Container,
  exampleValuesPath,
  findManifest,
  helm,
  loadExampleValues,
  mainContainer,
  type Manifest,
  parseManifests,
  podSpecOf,
  renderExample,
  templateArgs,
  withValuesFile,
} from "./helm-chart-render.ts";

const WORKLOADS = [
  ["Deployment", "api"],
  ["Deployment", "web"],
  ["Deployment", "gotenberg"],
  ["Deployment", "pgbouncer"],
  ["Deployment", "edge"],
  ["StatefulSet", "postgres"],
  ["StatefulSet", "redis"],
  ["CronJob", "backup"],
] as const;

const SERVICE_PORTS: Readonly<Record<string, number>> = {
  api: 3001,
  web: 3000,
  gotenberg: 3000,
  postgres: 5432,
  pgbouncer: 5432,
  redis: 6379,
  edge: 8080,
};

// Values derive from the key so no credential-looking literal is committed;
// the database one stays inside the URL-safe unreserved set.
const SECRET_VALUES: Readonly<Record<string, string>> = Object.fromEntries(
  [
    "DB_PASSWORD",
    "AUTH_JWT_SECRET",
    "PDF_EXPORT_JWT_SECRET",
    "AI_PROVIDER_CONFIG_ENCRYPTION_KEY",
    "SMTP_PASS",
  ].map((key) => [key, `fixture-${key.toLowerCase()}.value`]),
);

// Independent operator policy: removing a schema requirement must not also
// remove the corresponding negative render case.
const REQUIRED_VALUE_PATHS = [
  "images",
  "images.registry",
  "images.tag",
  "postgres",
  "postgres.db",
  "pgbouncer",
  "pgbouncer.maxClientConn",
  "pgbouncer.poolSize",
  "pgbouncer.reservePoolSize",
  "persistence",
  "persistence.storageClass",
  "persistence.postgresSize",
  "persistence.redisSize",
  "persistence.pdfSize",
  "persistence.backupSize",
  "edge",
  "edge.trustedProxies",
  "edge.cspReportUri",
  "edge.ingress",
  "edge.ingress.host",
  "backup",
  "backup.schedule",
  "backup.retentionDays",
  "api",
  "api.env",
  ...[
    "DB_POOL_MAX",
    "DB_POOL_IDLE_TIMEOUT_MS",
    "DB_POOL_CONNECTION_TIMEOUT_MS",
    "REDIS_DB",
    "FRONTEND_URL",
    "APP_BASE_URL",
    "LOG_LEVEL",
    "OTEL_SDK_DISABLED",
    "OTEL_TRACES_SAMPLER_ARG",
    "HEAP_HEALTH_THRESHOLD_BYTES",
    "CLIENT_LOG_FORWARDING",
    "PRODUCT_FEEDBACK_ENABLED",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_FROM",
    "KEYCLOAK_SAML_CALLBACK_URL",
    "KEYCLOAK_SAML_ENTRY_POINT",
    "KEYCLOAK_SAML_ISSUER",
    "KEYCLOAK_SAML_CERT",
    ...REQUIRED_REPORT_ASSISTANT_ENV_KEYS.filter(
      (key) => key !== "AI_PROVIDER_CONFIG_ENCRYPTION_KEY",
    ),
  ].map((key) => `api.env.${key}`),
];

function withoutPath(
  values: Readonly<Record<string, unknown>>,
  path: readonly string[],
): Record<string, unknown> {
  const copy = structuredClone(values);
  let cursor: Record<string, unknown> = copy;
  for (const key of path.slice(0, -1)) {
    cursor = cursor[key] as Record<string, unknown>;
  }
  delete cursor[path[path.length - 1] ?? ""];
  return copy;
}

function createSecretValues(
  overrides: Readonly<Record<string, string>> = {},
): Record<string, unknown> {
  return {
    ...loadExampleValues(),
    secrets: {
      existingSecret: "",
      create: true,
      values: { ...SECRET_VALUES, ...overrides },
    },
  };
}

function containerEnv(
  manifests: readonly Manifest[],
  name: string,
  variable: string,
): string | undefined {
  return mainContainer(manifests, "Deployment", name).env?.find(
    (entry) => entry.name === variable,
  )?.value;
}

test("helm lint passes with the complete example values", () => {
  const result = helm(["lint", chartDirectory, "-f", exampleValuesPath]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("helm lint without values fails closed", () => {
  assert.notEqual(helm(["lint", chartDirectory]).status, 0);
});

test("missing or blank operator policy fails rendering and names the input", () => {
  for (const label of REQUIRED_VALUE_PATHS) {
    const path = label.split(".");
    const missing = withoutPath(loadExampleValues(), path);
    const variants = [missing];
    const original = path.reduce<unknown>(
      (value, key) => (value as Record<string, unknown>)[key],
      loadExampleValues(),
    );
    if (typeof original === "string" && label !== "persistence.storageClass") {
      const blanked = structuredClone(loadExampleValues());
      const parent = path
        .slice(0, -1)
        .reduce<Record<string, unknown>>(
          (value, key) => value[key] as Record<string, unknown>,
          blanked,
        );
      parent[path.at(-1) ?? ""] = "";
      variants.push(blanked);
    }
    for (const values of variants) {
      const result = withValuesFile(values, (file) => helm(templateArgs(file)));
      assert.notEqual(result.status, 0, `${label} was optional or blank`);
      assert.equal(result.stdout, "", `${label} emitted a manifest`);
      assert.ok(
        result.stderr.includes(path.at(-1) ?? ""),
        `${label}: ${result.stderr}`,
      );
    }
  }
});

test("services keep the names and ports the images bake in", () => {
  const { manifests } = renderExample();
  const ports = Object.fromEntries(
    manifests
      .filter((manifest) => manifest.kind === "Service")
      .map((service) => [service.metadata.name, service.spec.ports?.[0]?.port]),
  );
  assert.deepEqual(ports, SERVICE_PORTS);
  const api = findManifest(manifests, "Deployment", "api");
  assert.equal(api.spec.replicas, 1);
  assert.deepEqual(api.spec.strategy, { type: "Recreate" });
});

test("one Ingress rule reaches only the edge Service", () => {
  const { manifests } = renderExample();
  const ingresses = manifests.filter((manifest) => manifest.kind === "Ingress");
  assert.equal(ingresses.length, 1);
  const rules = JSON.stringify(ingresses[0]?.spec.rules);
  assert.equal(rules.match(/"service":/g)?.length, 1);
  assert.match(rules, /"name":"edge"/);
});

test("every workload pod is hardened and carries no API token", () => {
  const { manifests } = renderExample();
  for (const [kind, name] of WORKLOADS) {
    const pod = podSpecOf(findManifest(manifests, kind, name));
    const label = `${kind}/${name}`;
    assert.equal(pod.automountServiceAccountToken, false, label);
    assert.equal(pod.enableServiceLinks, false, label);
    assert.equal(pod.securityContext.runAsNonRoot, true, label);
    assert.equal(typeof pod.securityContext.runAsUser, "number", label);
    assert.deepEqual(
      pod.securityContext.seccompProfile,
      { type: "RuntimeDefault" },
      label,
    );
    for (const container of [
      ...(pod.initContainers ?? []),
      ...pod.containers,
    ] satisfies Container[]) {
      const security = container.securityContext as {
        allowPrivilegeEscalation?: boolean;
        capabilities?: { drop?: string[] };
      };
      assert.equal(security.allowPrivilegeEscalation, false, label);
      assert.deepEqual(security.capabilities?.drop, ["ALL"], label);
    }
  }
});

test("the pull secret reaches every pod and no image uses latest", () => {
  const { manifests, raw } = renderExample();
  for (const [kind, name] of WORKLOADS) {
    const pod = podSpecOf(findManifest(manifests, kind, name));
    assert.deepEqual(pod.imagePullSecrets, [{ name: "registry-pull" }], name);
  }
  assert.doesNotMatch(raw, /image: \S+:latest\b/);
});

test("api literals cannot be changed and the release version follows the image tag", () => {
  const { manifests } = renderExample();
  assert.equal(containerEnv(manifests, "api", "AUTH_DEV_MODE"), "false");
  assert.equal(containerEnv(manifests, "api", "NODE_ENV"), "production");
  const tagged = renderExample(["--set", "images.tag=release-7"]).manifests;
  assert.equal(
    containerEnv(tagged, "api", "OTEL_SERVICE_VERSION"),
    "release-7",
  );
  const forged = withValuesFile(
    { ...loadExampleValues(), api: { env: { AUTH_DEV_MODE: "true" } } },
    (file) => helm(templateArgs(file)),
  );
  assert.notEqual(forged.status, 0);
});

test("the renderer keeps its isolation invariants", () => {
  const { manifests } = renderExample();
  assert.equal(
    containerEnv(manifests, "gotenberg", "CHROMIUM_MAX_CONCURRENCY"),
    "1",
  );
  for (const flag of [
    "CHROMIUM_CLEAR_COOKIES",
    "CHROMIUM_CLEAR_STORAGE",
    "CHROMIUM_CLEAR_CACHE",
    "CHROMIUM_DENY_PRIVATE_IPS",
    "CHROMIUM_DENY_PUBLIC_IPS",
  ]) {
    assert.equal(containerEnv(manifests, "gotenberg", flag), "true", flag);
  }
  assert.equal(containerEnv(manifests, "gotenberg", "API_TIMEOUT"), "150s");
});

test("the print allow-list is the escaped print origin for any namespace and domain", () => {
  for (const [namespace, domain] of [
    ["wr", "cluster.local"],
    ["team-a", "k8s.corp.example"],
  ] as const) {
    const result = helm([
      ...templateArgs(exampleValuesPath, ["--set", `clusterDomain=${domain}`]),
      "--namespace",
      namespace,
    ]);
    assert.equal(result.status, 0, result.stderr);
    const manifests = parseManifests(result.stdout);
    const origin = `http://web.${namespace}.svc.${domain}:3000`;
    assert.equal(containerEnv(manifests, "api", "PDF_BASE_URL"), origin);
    const allowList =
      containerEnv(manifests, "gotenberg", "CHROMIUM_ALLOW_LIST") ?? "";
    const escapedOrigin = origin.replaceAll(".", String.raw`\.`);
    assert.equal(allowList, `^${escapedOrigin}/`);
    assert.ok(new RegExp(allowList).test(`${origin}/print/1`));
    assert.ok(!new RegExp(allowList).test("http://api:3001/health"));
    assert.ok(
      !new RegExp(allowList).test(`${origin.replace("web.", "webX")}/print/1`),
    );
    assert.ok(
      !new RegExp(allowList).test(`http://elsewhere.invalid/${origin}/print/1`),
    );
  }
});

test("redis flag and api memory cap derive from one value", () => {
  const { manifests } = renderExample(["--set", "redis.maxmemoryMb=300"]);
  const args = mainContainer(manifests, "StatefulSet", "redis").args ?? [];
  assert.equal(args[args.indexOf("--maxmemory") + 1], "300mb");
  assert.equal(
    containerEnv(manifests, "api", "REDIS_MAXMEMORY_BYTES"),
    String(300 * 1024 * 1024),
  );
});

test("postgres server args are empty by default and pass through when set", () => {
  const read = (extra: readonly string[]) =>
    mainContainer(renderExample(extra).manifests, "StatefulSet", "postgres")
      .args;
  assert.equal(read([]), undefined);
  assert.deepEqual(
    read([
      "--set-string",
      "postgres.args[0]=-c",
      "--set-string",
      "postgres.args[1]=log_statement=all",
    ]),
    ["-c", "log_statement=all"],
  );
  const config = (extra: readonly string[]) =>
    renderExample(extra).manifests.find(
      (m) => m.kind === "ConfigMap" && m.metadata.name === "api-config",
    )?.data?.NODE_V8_COVERAGE;
  assert.equal(config([]), undefined);
  assert.equal(
    config(["--set-string", "api.extraEnv.NODE_V8_COVERAGE=/c"]),
    "/c",
  );
});

test("chart-created secrets stay out of every ConfigMap", () => {
  const result = withValuesFile(createSecretValues(), (file) =>
    helm(templateArgs(file)),
  );
  assert.equal(result.status, 0, result.stderr);
  const manifests = parseManifests(result.stdout);
  findManifest(manifests, "Secret", "weeklyreport-secrets");
  const maps = manifests.filter((manifest) => manifest.kind === "ConfigMap");
  assert.ok(maps.length > 0);
  for (const map of maps) {
    for (const supplied of Object.values(SECRET_VALUES)) {
      assert.ok(
        !Object.values(map.data ?? {}).includes(supplied),
        `${map.metadata.name} contains a secret value`,
      );
    }
  }
});

test("exactly one secret source is accepted", () => {
  const base = loadExampleValues();
  const both = {
    ...base,
    secrets: { existingSecret: "x", create: true, values: SECRET_VALUES },
  };
  const neither = { ...base, secrets: { existingSecret: "", create: false } };
  for (const values of [both, neither]) {
    const result = withValuesFile(values, (file) => helm(templateArgs(file)));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exactly one of secrets\.existingSecret/);
  }
});

test("a database password with a URL-reserved character is rejected at render time", () => {
  for (const password of ["a@b", "pa ss", "pa/ss", "x:y", "pa%ss"]) {
    const result = withValuesFile(
      createSecretValues({ DB_PASSWORD: password }),
      (file) => helm(templateArgs(file)),
    );
    assert.notEqual(result.status, 0, password);
    assert.match(result.stderr, /secrets\.values\.DB_PASSWORD/);
  }
});

function runMigrateCommand(password: string): {
  readonly status: number | null;
  readonly started: boolean;
  readonly output: string;
  readonly arguments: string;
} {
  const [init] =
    podSpecOf(findManifest(renderExample().manifests, "Deployment", "api"))
      .initContainers ?? [];
  assert.ok(init, "the api pod has no initContainer");
  const command = init.command ?? [];
  assert.deepEqual(command.slice(0, 2), ["sh", "-ec"]);
  const directory = mkdtempSync(join(tmpdir(), "migrate-guard-"));
  try {
    const bin = join(directory, "node_modules", ".bin");
    mkdirSync(bin, { recursive: true });
    const prisma = join(bin, "prisma");
    writeFileSync(
      prisma,
      `#!/bin/sh\nprintf '%s\\n' "$@" > '${join(directory, "started")}'\n`,
    );
    chmodSync(prisma, 0o755);
    const result = spawnSync("/bin/sh", ["-ec", command[2] ?? ""], {
      cwd: directory,
      env: { PATH: process.env.PATH ?? "", DB_PASSWORD: password },
      encoding: "utf8",
    });
    return {
      status: result.status,
      started: existsSync(join(directory, "started")),
      output: result.stdout + result.stderr,
      arguments: existsSync(join(directory, "started"))
        ? readFileSync(join(directory, "started"), "utf8")
        : "",
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("the backup pod shares the postgres node and the job is bounded in time", () => {
  // pgbackups is ReadWriteOnce and mounted by postgres, so on a multi-node
  // cluster the Job must be scheduled onto the postgres node or the volume
  // attach deadlocks and concurrencyPolicy=Forbid blocks every later run.
  const { manifests } = renderExample();
  const cronJob = findManifest(manifests, "CronJob", "backup");
  const [term] =
    podSpecOf(cronJob).affinity?.podAffinity
      ?.requiredDuringSchedulingIgnoredDuringExecution ?? [];
  assert.equal(term?.topologyKey, "kubernetes.io/hostname");
  assert.deepEqual(term.labelSelector?.matchLabels, {
    "app.kubernetes.io/name": "weeklyreport",
    "app.kubernetes.io/component": "postgres",
  });
  assert.equal(cronJob.spec.jobTemplate?.spec.activeDeadlineSeconds, 1800);
  const tuned = renderExample(["--set", "backup.activeDeadlineSeconds=60"]);
  assert.equal(
    findManifest(tuned.manifests, "CronJob", "backup").spec.jobTemplate?.spec
      .activeDeadlineSeconds,
    60,
  );
  const rejected = helm([
    ...templateArgs(exampleValuesPath),
    "--set",
    "backup.activeDeadlineSeconds=0",
  ]);
  assert.notEqual(rejected.status, 0);
});

test("the migrate command checks the password before any database work", () => {
  const good = runMigrateCommand(SECRET_VALUES.DB_PASSWORD ?? "");
  assert.equal(good.status, 0);
  assert.equal(good.started, true);
  assert.equal(good.arguments, "migrate\ndeploy\n");
  for (const bad of ["a@b", "pa ss", "p/w", ""]) {
    const rejected = runMigrateCommand(bad);
    assert.notEqual(rejected.status, 0, JSON.stringify(bad));
    assert.equal(rejected.started, false, JSON.stringify(bad));
    if (bad !== "") {
      assert.ok(!rejected.output.includes(bad), "the password was printed");
    }
  }
});

test("chart-created authentication secrets cannot be missing or blank", () => {
  for (const key of [
    "DB_PASSWORD",
    "AUTH_JWT_SECRET",
    "PDF_EXPORT_JWT_SECRET",
    "AI_PROVIDER_CONFIG_ENCRYPTION_KEY",
  ]) {
    for (const blank of [false, true]) {
      const supplied = { ...SECRET_VALUES };
      if (blank) supplied[key] = "";
      else delete supplied[key];
      const values = {
        ...loadExampleValues(),
        secrets: { existingSecret: "", create: true, values: supplied },
      };
      const result = withValuesFile(values, (file) => helm(templateArgs(file)));
      assert.notEqual(result.status, 0, key);
      assert.equal(result.stdout, "", key);
      assert.ok(result.stderr.includes(key), result.stderr);
    }
  }
});

test("unsafe database names are refused before any workload is emitted", () => {
  for (const db of [
    "unsafe/name",
    "unsafe-name",
    "unsafe@host",
    "unsafe name",
    "",
  ]) {
    const result = helm(
      templateArgs(exampleValuesPath, ["--set-string", `postgres.db=${db}`]),
    );
    assert.notEqual(result.status, 0, JSON.stringify(db));
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /postgres[\s\S]*db/);
  }
});
