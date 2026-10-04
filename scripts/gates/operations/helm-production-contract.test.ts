import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { test } from "vitest";

import { envSchema } from "../../../apps/api/src/infrastructure/config/env.schema.ts";
import {
  chartDirectory,
  type Container,
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

function environment(container: Container): Record<string, string | undefined> {
  return Object.fromEntries(
    (container.env ?? []).map((entry) => [entry.name, entry.value]),
  );
}

function renderedApiEnvironment(
  manifests: readonly Manifest[],
): Record<string, string> {
  const container = mainContainer(manifests, "Deployment", "api");
  const resolved: Record<string, string> = {};
  for (const source of container.envFrom ?? []) {
    assert.ok(source.configMapRef);
    Object.assign(
      resolved,
      findManifest(manifests, "ConfigMap", source.configMapRef.name).data,
    );
  }
  for (const entry of container.env ?? []) {
    const secret = entry.valueFrom?.secretKeyRef;
    const value =
      entry.value ??
      (secret === undefined
        ? undefined
        : findManifest(manifests, "Secret", secret.name).stringData?.[
            secret.key
          ]);
    if (value === undefined && secret?.optional === true) continue;
    assert.ok(value !== undefined, `${entry.name} is not supplied`);
    resolved[entry.name] = value.replaceAll(
      /\$\(([A-Z_]+)\)/gu,
      (_, key: string) => {
        const expanded = resolved[key];
        assert.ok(
          expanded !== undefined,
          `${entry.name} refers to undefined ${key}`,
        );
        return expanded;
      },
    );
  }
  return resolved;
}

test("the rendered API environment satisfies its production startup contract", () => {
  const example = loadExampleValues();
  const optionalInputs = {
    FRONTEND_URLS: "https://admin.example.com",
    OTEL_EXPORTER_OTLP_ENDPOINT: "https://telemetry.example.com",
    SMTP_USER: "fixture-user",
    SMTP_PASS: "fixture-value",
    SENTRY_DSN: "https://fixture@sentry.example.com/1",
  };
  const values = {
    ...example,
    api: {
      ...(example.api as Record<string, unknown>),
      env: {
        ...(example.api as { readonly env: Record<string, unknown> }).env,
        FRONTEND_URLS: optionalInputs.FRONTEND_URLS,
        OTEL_EXPORTER_OTLP_ENDPOINT: optionalInputs.OTEL_EXPORTER_OTLP_ENDPOINT,
      },
    },
    secrets: {
      existingSecret: "",
      create: true,
      values: {
        SMTP_USER: optionalInputs.SMTP_USER,
        SMTP_PASS: optionalInputs.SMTP_PASS,
        SENTRY_DSN: optionalInputs.SENTRY_DSN,
        ...Object.fromEntries(
          [
            "DB_PASSWORD",
            "AUTH_JWT_SECRET",
            "PDF_EXPORT_JWT_SECRET",
            "AI_PROVIDER_CONFIG_ENCRYPTION_KEY",
          ].map((key) => [
            key,
            `fixture.${key.toLowerCase()}.value.`.repeat(2),
          ]),
        ),
      },
    },
  };
  const rendered = withValuesFile(values, (file) => helm(templateArgs(file)));
  assert.equal(rendered.status, 0, rendered.stderr);
  const env = renderedApiEnvironment(parseManifests(rendered.stdout));
  const result = envSchema.safeParse(env);
  assert.ok(
    result.success,
    result.success ? "" : JSON.stringify(result.error.issues),
  );
  assert.equal(env.NODE_ENV, "production");
  assert.equal(env.AUTH_DEV_MODE, "false");
  for (const [key, value] of Object.entries(optionalInputs))
    assert.equal(env[key], value, key);
});

test("all repository-built workloads use the selected registry and exact release", () => {
  const { manifests } = renderExample([
    "--set",
    "images.registry=registry.example.com/approved",
    "--set",
    "images.tag=release-7",
  ]);
  const containers = [
    mainContainer(manifests, "Deployment", "api"),
    mainContainer(manifests, "Deployment", "web"),
    mainContainer(manifests, "CronJob", "backup"),
    ...(podSpecOf(findManifest(manifests, "Deployment", "api"))
      .initContainers ?? []),
  ];
  assert.equal(containers.length, 4);
  for (const name of ["api", "web", "backup", "migrate"]) {
    assert.equal(
      containers.find((container) => container.name === name)?.image,
      `registry.example.com/approved/${name}:release-7`,
    );
  }
  const latest = helm(
    templateArgs("deploy/helm/weeklyreport/values.production.example.yaml", [
      "--set",
      "images.tag=latest",
    ]),
  );
  assert.notEqual(latest.status, 0);
  assert.equal(latest.stdout, "");
  assert.match(latest.stderr, /tag/);
});

test("the API pools connections while migration and backup use direct postgres sessions", () => {
  const { manifests } = renderExample([
    "--set",
    "postgres.db=review_database",
    "--set",
    "pgbouncer.maxClientConn=70",
    "--set",
    "pgbouncer.poolSize=12",
    "--set",
    "pgbouncer.reservePoolSize=3",
  ]);
  const api = findManifest(manifests, "Deployment", "api");
  const [migrate] = podSpecOf(api).initContainers ?? [];
  assert.ok(migrate);
  assert.equal(migrate.name, "migrate");
  assert.equal((podSpecOf(api).initContainers ?? []).length, 1);
  assert.equal(
    environment(migrate).DATABASE_URL,
    "postgresql://customreport:$(DB_PASSWORD)@postgres:5432/review_database",
  );
  assert.equal(
    environment(mainContainer(manifests, "Deployment", "api")).DATABASE_URL,
    "postgresql://customreport:$(DB_PASSWORD)@pgbouncer:5432/review_database?pgbouncer=true&connection_limit=1",
  );
  const pool = environment(mainContainer(manifests, "Deployment", "pgbouncer"));
  for (const [key, expected] of Object.entries({
    DB_HOST: "postgres",
    DB_PORT: "5432",
    DB_NAME: "review_database",
    POOL_MODE: "transaction",
    MAX_CLIENT_CONN: "70",
    DEFAULT_POOL_SIZE: "12",
    RESERVE_POOL_SIZE: "3",
  }))
    assert.equal(pool[key], expected, key);
  const backup = environment(mainContainer(manifests, "CronJob", "backup"));
  assert.equal(backup.PGHOST, "postgres");
  assert.equal(backup.PGPORT, "5432");
  assert.equal(backup.PGDATABASE, "review_database");
  assert.equal(
    environment(mainContainer(manifests, "StatefulSet", "postgres"))
      .POSTGRES_DB,
    "review_database",
  );
});

test("workloads remain private behind the edge without host networking or ports", () => {
  const { manifests } = renderExample();
  for (const manifest of manifests.filter((item) => item.kind === "Service")) {
    assert.equal(
      manifest.spec.type ?? "ClusterIP",
      "ClusterIP",
      manifest.metadata.name,
    );
    assert.deepEqual(manifest.spec.externalIPs ?? [], []);
    assert.equal(manifest.spec.externalName, undefined);
    for (const port of manifest.spec.ports ?? [])
      assert.equal(port.nodePort, undefined);
  }
  for (const manifest of manifests.filter((item) =>
    ["Deployment", "StatefulSet", "CronJob"].includes(item.kind),
  )) {
    const pod = podSpecOf(manifest);
    assert.notEqual(pod.hostNetwork, true, manifest.metadata.name);
    for (const container of [
      ...(pod.initContainers ?? []),
      ...pod.containers,
    ]) {
      for (const port of container.ports ?? [])
        assert.equal(port.hostPort, undefined, container.name);
    }
  }
  const caddyfile = findManifest(manifests, "ConfigMap", "edge-caddyfile").data
    ?.Caddyfile;
  assert.ok(caddyfile);
  assert.doesNotMatch(caddyfile, /gotenberg/iu);
  const edge = mainContainer(manifests, "Deployment", "edge");
  const mount = edge.volumeMounts?.find(
    (entry) => entry.mountPath === "/etc/caddy/Caddyfile",
  );
  assert.ok(
    mount,
    "Caddy must mount its canonical route and security configuration",
  );
  assert.equal(mount.readOnly, true);
  assert.equal(mount.subPath, "Caddyfile");
  const edgePod = podSpecOf(findManifest(manifests, "Deployment", "edge"));
  const volume = edgePod.volumes?.find((entry) => entry.name === mount.name);
  assert.equal(volume?.configMap?.name, "edge-caddyfile");
  assert.equal(
    caddyfile.trimEnd(),
    readFileSync(join(chartDirectory, "files/Caddyfile"), "utf8").trimEnd(),
  );
  const web = environment(mainContainer(manifests, "Deployment", "web"));
  assert.equal(web.API_URL, "http://api:3001");
  const api = environment(mainContainer(manifests, "Deployment", "api"));
  assert.equal(api.GOTENBERG_URL, "http://gotenberg:3000");
});

// These are reviewed containment ceilings, not measured capacity claims.
const MEMORY_LIMITS: Readonly<Record<string, string>> = {
  api: "2Gi",
  migrate: "512Mi",
  web: "512Mi",
  gotenberg: "1Gi",
  postgres: "512Mi",
  pgbouncer: "128Mi",
  redis: "256Mi",
  caddy: "256Mi",
  backup: "256Mi",
};

function memoryBytes(value: string | undefined): number {
  assert.ok(value !== undefined, "memory must be explicit");
  const matched = /^(\d+)(Mi|Gi)$/u.exec(value);
  assert.ok(matched, `unexpected memory quantity: ${value}`);
  return Number(matched[1]) * (matched[2] === "Gi" ? 1024 ** 3 : 1024 ** 2);
}

test("every container has a memory request within its reviewed containment limit", () => {
  const { manifests } = renderExample();
  const seen = new Set<string>();
  for (const manifest of manifests.filter((item) =>
    ["Deployment", "StatefulSet", "CronJob"].includes(item.kind),
  )) {
    const pod = podSpecOf(manifest);
    for (const container of [
      ...(pod.initContainers ?? []),
      ...pod.containers,
    ]) {
      seen.add(container.name);
      assert.equal(
        container.resources?.limits?.memory,
        MEMORY_LIMITS[container.name],
        container.name,
      );
      const requested = memoryBytes(container.resources?.requests?.memory);
      assert.ok(
        requested > 0 &&
          requested <= memoryBytes(container.resources?.limits?.memory),
        container.name,
      );
    }
  }
  assert.deepEqual(seen, new Set(Object.keys(MEMORY_LIMITS)));
});

test("probes exercise readiness and renderer health while liveness keeps its dependency boundary", () => {
  const { manifests } = renderExample();
  const api = mainContainer(manifests, "Deployment", "api");
  assert.deepEqual(api.startupProbe?.httpGet, {
    path: "/health/ready",
    port: "http",
  });
  assert.deepEqual(api.readinessProbe?.httpGet, {
    path: "/health/ready",
    port: "http",
  });
  assert.deepEqual(api.livenessProbe?.httpGet, {
    path: "/health/live",
    port: "http",
  });
  assert.ok(
    (api.startupProbe.periodSeconds ?? 0) *
      (api.startupProbe.failureThreshold ?? 0) >=
      60,
  );
  const web = mainContainer(manifests, "Deployment", "web");
  assert.deepEqual(web.readinessProbe?.httpGet, { path: "/", port: "http" });
  assert.deepEqual(web.livenessProbe?.tcpSocket, { port: "http" });
  const renderer = mainContainer(manifests, "Deployment", "gotenberg");
  for (const probe of [renderer.readinessProbe, renderer.livenessProbe]) {
    assert.deepEqual(probe?.httpGet, { path: "/health", port: "http" });
  }
  const edge = mainContainer(manifests, "Deployment", "edge");
  for (const probe of [edge.readinessProbe, edge.livenessProbe]) {
    assert.deepEqual(probe?.exec?.command, [
      "wget",
      "-q",
      "--spider",
      "http://127.0.0.1:2019/config/",
    ]);
  }
  const pool = mainContainer(manifests, "Deployment", "pgbouncer");
  for (const probe of [pool.readinessProbe, pool.livenessProbe]) {
    const command = probe?.exec?.command ?? [];
    assert.deepEqual(command.slice(0, 2), ["sh", "-c"]);
    assert.match(
      command[2] ?? "",
      /psql -h 127\.0\.0\.1 -p 5432[\s\S]*-d "\$DB_NAME"[\s\S]*SELECT 1[\s\S]*\|\| exit 1/u,
    );
  }
});

test("backup runs its baked entrypoint once and mounts only the backup data", () => {
  const { manifests } = renderExample();
  const job = findManifest(manifests, "CronJob", "backup");
  assert.equal(job.spec.concurrencyPolicy, "Forbid");
  const backup = mainContainer(manifests, "CronJob", "backup");
  assert.deepEqual(backup.command, ["/usr/local/bin/backup-loop.sh"]);
  assert.equal(environment(backup).BACKUP_RUN_ONCE, "true");
  assert.equal(environment(backup).BACKUP_INTERVAL_SECONDS, undefined);
  assert.deepEqual(backup.volumeMounts, [
    { name: "pgbackups", mountPath: "/backups" },
  ]);
  assert.deepEqual(podSpecOf(job).volumes, [
    { name: "pgbackups", persistentVolumeClaim: { claimName: "pgbackups" } },
  ]);
});
