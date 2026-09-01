import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { REQUIRED_REPORT_ASSISTANT_ENV_KEYS } from "../../../apps/api/src/infrastructure/config/report-assistant-env-keys.ts";

const prodCompose = resolve("docker-compose.prod.yml");
const devCompose = resolve("docker-compose.yml");
const devOverrideCompose = resolve("docker-compose.dev.yml");
const productionEnvironmentTemplate = resolve(
  "deploy/environment/production.env.example",
);
const workflow = resolve(".github/workflows/ci.yml");
const observabilityCompose = resolve("docker-compose.observability.yml");
const errorsCompose = resolve("docker-compose.errors.yml");
const gitIgnore = resolve(".gitignore");
const dockerIgnore = resolve(".dockerignore");

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
  "POSTGRES_DB",
  "DB_POOL_MAX",
  "DB_POOL_IDLE_TIMEOUT_MS",
  "DB_POOL_CONNECTION_TIMEOUT_MS",
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
  "AI_PROVIDER_CONFIG_ENCRYPTION_KEY",
  "AI_PROVIDER_CONFIG_KEY_VERSION",
  "AI_PROVIDER_ALLOWED_ORIGINS",
  "REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED",
  "REPORT_ASSISTANT_INPUT_VERSION",
  "REPORT_ASSISTANT_SIMILARITY_THRESHOLD",
  "REPORT_ASSISTANT_CANDIDATE_LIMIT",
  "REPORT_ASSISTANT_READ_THROUGH_LIMIT",
  "REPORT_ASSISTANT_EXHAUSTIVE_LIMIT",
  "REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET",
  "REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS",
  "REPORT_ASSISTANT_PLANNER_MAX_TOKENS",
  "REPORT_ASSISTANT_ANSWER_MAX_TOKENS",
  "REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE",
  "REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET",
  "LOG_LEVEL",
  "REDIS_DB",
  "OTEL_SDK_DISABLED",
  "OTEL_SERVICE_VERSION",
  "OTEL_TRACES_SAMPLER_ARG",
  "HEAP_HEALTH_THRESHOLD_BYTES",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_FROM",
  "KEYCLOAK_SAML_CALLBACK_URL",
  "KEYCLOAK_SAML_ENTRY_POINT",
  "KEYCLOAK_SAML_ISSUER",
  "KEYCLOAK_SAML_CERT",
  "NEXT_PUBLIC_CLIENT_LOG_FORWARDING",
  "NEXT_PUBLIC_WEB_VITALS",
  "CLIENT_LOG_FORWARDING",
  "CADDY_SITE_ADDRESS",
  "CADDY_ACME_EMAIL",
  "CADDY_CSP_REPORT_URI",
  "HTTP_PORT",
  "HTTPS_PORT",
  "HTTPS_PORT_QUIC",
] as const;

const content = readFileSync(prodCompose, "utf8");
const devContent = readFileSync(devCompose, "utf8");
const devOverrideContent = readFileSync(devOverrideCompose, "utf8");
const productionEnvironment = readFileSync(
  productionEnvironmentTemplate,
  "utf8",
);
const workflowContent = readFileSync(workflow, "utf8");
const observabilityContent = readFileSync(observabilityCompose, "utf8");
const errorsContent = readFileSync(errorsCompose, "utf8");
const gitIgnoreContent = readFileSync(gitIgnore, "utf8");
const dockerIgnoreContent = readFileSync(dockerIgnore, "utf8");
const backupDockerfile = readFileSync(
  resolve("deploy/postgres/Dockerfile.backup"),
  "utf8",
);
const apiDockerfile = readFileSync(resolve("Dockerfile.api"), "utf8");
const webDockerfile = readFileSync(resolve("Dockerfile.web"), "utf8");
const REVIEWED_EXTERNAL_IMAGES = new Set([
  "postgres:15.19-alpine@sha256:fe0737ba566a2c5b2a28f34433c0a423261900ec17b9bf7ad115e1aae7e57f1b",
  "pgvector/pgvector:0.8.6-pg15-bookworm@sha256:a947c45cdc5906a1bc951f20a8709e321256343ee0f251e4ae00b5e7def4e6da",
  "edoburu/pgbouncer:v1.25.2-p0@sha256:7d7a27d9e90985cab5cf42256f5c13a3120baa4b055b69df37beb272b89b2340",
  "redis:7.4.11-alpine@sha256:ff02b58f971e7d7d156a1267e283fcbbeee91773b6aa36c49dac28ecfe28eadf",
  "caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648",
  "axllent/mailpit:v1.31.0@sha256:c96991d9bef73594c246d89ca81411d4e916f03e76a7d2d72fa2ab5dd3c9ce24",
  "grafana/otel-lgtm:0.32.0@sha256:d6b20e35890ef2f91d13944805939acdaf1e5d3ffbf9f9aed08586312826c815",
  "prometheuscommunity/postgres-exporter:v0.20.1@sha256:ac5ec343104fae0e2d84a27bb8d69b38430a11910c5382cad85d478d2bab713e",
  "oliver006/redis_exporter:v1.90.0@sha256:a129504e65b87c54f79bc92f1afc403475e8ff646a3d7512de469904ceddf986",
  "bugsink/bugsink:2.5.1@sha256:ecdd845877464d70d61244b8adba20d623e1860e88d8338f2808d9cc2925745c",
]);
const releaseImageTag =
  "$" +
  "{OTEL_SERVICE_VERSION:?set the deployed release version (for example the Git SHA)}";
const REVIEWED_LOCAL_BUILD_IMAGES = new Map([
  ["docker-compose.prod.yml:backup", `customreport-backup:${releaseImageTag}`],
  [
    "docker-compose.prod.yml:migrate",
    `customreport-migrate:${releaseImageTag}`,
  ],
  ["docker-compose.prod.yml:api", `customreport-api:${releaseImageTag}`],
  ["docker-compose.prod.yml:web", `customreport-web:${releaseImageTag}`],
]);
const turboConfig = JSON.parse(readFileSync(resolve("turbo.json"), "utf8")) as {
  readonly globalEnv?: readonly string[];
};

void test("Docker build context excludes TypeScript test harnesses", () => {
  for (const pattern of [
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/*.integration.test.ts",
    "**/*.integration.test.tsx",
    "**/__tests__",
    "**/test-utils",
    "**/*-fixtures.ts",
    "**/*-fixtures.tsx",
    "**/*.fixtures.ts",
    "**/*.fixtures.tsx",
    "**/*.fixture.ts",
    "**/*.fixture.tsx",
    "**/*stub*.ts",
    "**/*stub*.tsx",
    "**/*harness*.ts",
    "**/*harness*.tsx",
    "**/test-seams",
    "**/__snapshots__",
    "**/*.snap",
  ]) {
    assert.ok(
      dockerIgnoreContent.split("\n").includes(pattern),
      `${dockerIgnore} must exclude ${pattern}`,
    );
  }
});

void test("Docker build context retains the production-prune self-test", () => {
  const fixture = "scripts/gates/production-deps-prune.fixture.test.ts";
  assert.ok(
    dockerIgnoreContent.split("\n").includes(`!${fixture}`),
    `${dockerIgnore} must retain ${fixture}`,
  );
  assert.ok(
    apiDockerfile.includes(`COPY ${fixture} `),
    `Dockerfile.api must copy ${fixture}`,
  );
});

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

void test("the production template lists every required input as fail-closed", () => {
  const assignments = new Map(
    productionEnvironment
      .split("\n")
      .filter((line) => /^[A-Z][A-Z0-9_]*=/u.test(line))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)] as const;
      }),
  );
  const safePolicyValues = new Set([
    "AI_PROVIDER_CONFIG_KEY_VERSION",
    "AI_PROVIDER_ALLOWED_ORIGINS",
    "REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED",
    "REPORT_ASSISTANT_INPUT_VERSION",
    "REPORT_ASSISTANT_SIMILARITY_THRESHOLD",
    "REPORT_ASSISTANT_CANDIDATE_LIMIT",
    "REPORT_ASSISTANT_READ_THROUGH_LIMIT",
    "REPORT_ASSISTANT_EXHAUSTIVE_LIMIT",
    "REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET",
    "REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS",
    "REPORT_ASSISTANT_PLANNER_MAX_TOKENS",
    "REPORT_ASSISTANT_ANSWER_MAX_TOKENS",
    "REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE",
    "REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET",
    "REDIS_DB",
    "LOG_LEVEL",
    "OTEL_SDK_DISABLED",
    "OTEL_TRACES_SAMPLER_ARG",
    "NEXT_PUBLIC_CLIENT_LOG_FORWARDING",
    "NEXT_PUBLIC_WEB_VITALS",
    "CLIENT_LOG_FORWARDING",
    "HTTP_PORT",
    "HTTPS_PORT",
    "HTTPS_PORT_QUIC",
  ]);

  for (const variable of REQUIRED_POLICY_INPUTS) {
    assert.ok(
      assignments.has(variable),
      `${variable} must exist in the production template`,
    );
    if (!safePolicyValues.has(variable)) {
      assert.equal(
        assignments.get(variable),
        "",
        `${variable} must remain empty so an untouched template fails closed`,
      );
    }
  }
});

const DEV_APP_DATABASE_URL =
  "postgresql://customreport:localdev@postgres:5432/customreport_e2e";
const DEV_APP_DATABASE_ASSIGNMENT_COUNT = 2;

void test("development Compose owns one exact guarded database target", () => {
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

void test("development API watches the current persistence source", () => {
  assert.match(
    devOverrideContent,
    /- \.\/packages\/report-persistence\/src:\/app\/packages\/report-persistence\/src/u,
  );
  assert.match(
    devOverrideContent,
    /action: restart\n\s+path: \.\/packages\/report-persistence\/src/u,
  );
});

const extractPublishedPorts = (source: string): readonly string[] => {
  const publishedPorts: string[] = [];
  let portsIndent: number | undefined;

  for (const line of source.split("\n")) {
    const indentation = line.length - line.trimStart().length;
    if (/^\s+ports:\s*$/u.test(line)) {
      portsIndent = indentation;
      continue;
    }
    if (portsIndent === undefined || line.trim().length === 0) continue;
    if (indentation <= portsIndent) {
      portsIndent = undefined;
      continue;
    }
    const port = /^\s+-\s+"([^"]+)"\s*$/u.exec(line)?.[1];
    if (port !== undefined) publishedPorts.push(port);
  }

  return publishedPorts;
};

const assertLoopbackPublishedPorts = (
  source: string,
  sourcePath: string,
): readonly string[] => {
  const ports = extractPublishedPorts(source);
  assert.ok(
    ports.length > 0,
    `${sourcePath} must publish its expected dev ports`,
  );
  for (const port of ports) {
    assert.match(
      port,
      /^127\.0\.0\.1:\d+:\d+$/u,
      `${sourcePath} must bind ${port} explicitly to loopback`,
    );
  }
  return ports;
};

void test("every development host port binds to loopback", () => {
  const basePorts = assertLoopbackPublishedPorts(devContent, devCompose);
  assert.deepEqual(basePorts, [
    "127.0.0.1:5432:5432",
    "127.0.0.1:1025:1025",
    "127.0.0.1:8025:8025",
    "127.0.0.1:6379:6379",
    "127.0.0.1:3002:3002",
    "127.0.0.1:3000:3000",
  ]);
});

void test("development port guard rejects a planted wildcard binding", () => {
  const planted = devContent.replace('"127.0.0.1:6379:6379"', '"6379:6379"');
  assert.notEqual(planted, devContent);
  assert.throws(
    () => assertLoopbackPublishedPorts(planted, "planted-compose.yml"),
    /must bind 6379:6379 explicitly to loopback/,
  );
});

void test("the production image receives one release identity", () => {
  assert.match(
    content,
    /NEXT_PUBLIC_APP_VERSION: \$\{OTEL_SERVICE_VERSION:\?/u,
  );
  assert.match(workflowContent, /POSTGRES_DB: customreport/u);
  assert.match(
    workflowContent,
    /OTEL_SERVICE_VERSION: \$\{\{ github\.sha \}\}/u,
  );
  for (const dockerfile of [apiDockerfile, webDockerfile, backupDockerfile]) {
    assert.match(
      dockerfile,
      /LABEL org\.opencontainers\.image\.revision=\$\{/u,
    );
  }
});

void test("production dependency layers retain a shared pnpm BuildKit cache", () => {
  const cacheMount =
    "--mount=type=cache,id=customreport-pnpm-store-v11,target=/pnpm/store,sharing=locked";
  // API installs the full build graph once, the isolated migrator runtime once,
  // and production dependencies once; each uses the same locked store.
  assert.equal(apiDockerfile.split(cacheMount).length - 1, 3);
  assert.equal(webDockerfile.split(cacheMount).length - 1, 1);
  for (const dockerfile of [apiDockerfile, webDockerfile]) {
    assert.match(
      dockerfile,
      /pnpm install[^\n]*--store-dir=\/pnpm\/store --network-concurrency=4/u,
    );
  }
});

void test("production builders carry the complete dist gate policy", () => {
  for (const [path, dockerfile] of [
    ["Dockerfile.api", apiDockerfile],
    ["Dockerfile.web", webDockerfile],
  ] as const) {
    assert.match(
      dockerfile,
      /COPY scripts\/gates\/production-dist\.ts \.\/scripts\/gates\/production-dist\.ts/u,
      `${path} must copy production-dist.ts into the pruned builder`,
    );
    assert.match(
      dockerfile,
      /COPY scripts\/gates\/production-dist-policy\.ts \.\/scripts\/gates\/production-dist-policy\.ts/u,
      `${path} must copy production-dist-policy.ts into the pruned builder`,
    );
  }
});

void test("the migrator target contains only the canonical migration runtime", () => {
  const baseImage = /^FROM (node:\S+) AS base$/mu.exec(apiDockerfile)?.[1];
  assert.ok(baseImage, "Dockerfile.api must define a pinned Node base image");
  const start = apiDockerfile.indexOf(`FROM ${baseImage} AS migrator`);
  const end = apiDockerfile.indexOf("\n# Stage 6: Build", start);
  assert.notEqual(start, -1, "Dockerfile.api must define a migrator target");
  assert.notEqual(
    end,
    -1,
    "Dockerfile.api must keep the builder after migrator",
  );
  const migrator = apiDockerfile.slice(start, end);
  assert.doesNotMatch(migrator, /FROM installer/u);
  assert.doesNotMatch(migrator, /FROM base AS migrator/u);
  assert.doesNotMatch(migrator, /printf .*package\.json/u);
  assert.match(
    apiDockerfile.slice(
      apiDockerfile.indexOf("FROM installer AS migrator-deps"),
      start,
    ),
    /deploy --prod --legacy --frozen-lockfile \/tmp\/migrate-deps/u,
  );
  assert.match(
    migrator,
    /COPY --from=migrator-deps \/tmp\/migrate-deps\/node_modules/u,
  );
  assert.match(
    migrator,
    /COPY --from=migrator-deps \/app\/prisma\/migrations \.\/prisma\/migrations/u,
  );
  assert.match(
    migrator,
    /COPY --from=migrator-deps \/app\/prisma\/migration\.config\.ts \.\/prisma\.config\.ts/u,
  );
  assert.match(migrator, /\/app\/prisma\/schema\.prisma/u);
  assert.match(
    migrator,
    /! grep -Eq 'seed\|apps\/api\|tsx\|pnpm' \/app\/prisma\.config\.ts/u,
  );
  assert.match(migrator, /\/app\/prisma\/migrations\/migration_lock\.toml/u);
  assert.match(
    migrator,
    /find \/app\/prisma\/migrations -type f -name '\*\.sql'/u,
  );
  assert.match(migrator, /test ! -e \/app\/apps/u);
  assert.match(migrator, /test ! -e \/app\/packages/u);
  assert.match(migrator, /test ! -e \/app\/node_modules\/\.bin\/pnpm/u);
  assert.match(migrator, /test ! -e \/app\/node_modules\/\.bin\/turbo/u);
  assert.match(migrator, /test ! -e \/usr\/local\/bin\/pnpm/u);
  assert.match(migrator, /test ! -e \/usr\/local\/bin\/turbo/u);
  assert.match(migrator, /test ! -e \/app\/node_modules\/@customreport/u);
  assert.match(migrator, /test ! -e \/app\/scripts/u);
  assert.match(migrator, /test ! -e \/app\/prisma\/operations/u);
  assert.match(migrator, /test ! -e \/app\/prisma\/guards/u);
  assert.match(migrator, /test ! -e \/app\/prisma\/seeds/u);
  assert.match(
    migrator,
    /test ! -e \/app\/prisma\/migrations\/canonical-init-contract\.test\.ts/u,
  );
  assert.match(
    migrator,
    /CMD \["\.\/node_modules\/\.bin\/prisma", "migrate", "deploy"\]/u,
  );
});

void test("the API runner excludes migration-only tooling", () => {
  assert.match(
    apiDockerfile,
    /pnpm --filter=@customreport\/api deploy --prod --legacy --frozen-lockfile --ignore-scripts \/tmp\/api-deps/u,
  );
  assert.match(
    apiDockerfile,
    /production-deps-prune\.ts \/tmp\/api-deps/u,
    "the API production deploy must run the deterministic dependency-closure prune",
  );
  assert.match(
    apiDockerfile,
    /production-deps-prune\.fixture\.test\.ts/u,
    "the API dependency layer must execute the behavioral prune fixture",
  );
  const runner = apiDockerfile.slice(apiDockerfile.indexOf(" AS runner"));
  assert.match(runner, /test ! -e \/app\/node_modules\/\.bin\/prisma/u);
  assert.match(
    runner,
    /test ! -e \/app\/node_modules\/@customreport\/migrator-runtime/u,
  );
  assert.match(runner, /find \/app\/node_modules\/\.pnpm -maxdepth 1 -type d/u);
  assert.match(
    runner,
    /@typescript\+typescript6@\*/u,
    "the API runner must reject the aliased TypeScript compiler payload",
  );
});

void test("post-install production tools bypass pnpm dependency preflight", () => {
  assert.ok(
    turboConfig.globalEnv?.includes("PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN"),
  );

  const dependencyPolicy = "ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false";
  for (const [path, dockerfile, buildCommand] of [
    [
      "Dockerfile.api",
      apiDockerfile,
      "RUN ./node_modules/.bin/turbo build --filter=@customreport/api",
    ],
    [
      "Dockerfile.web",
      webDockerfile,
      "RUN ./node_modules/.bin/turbo build --filter=@customreport/web",
    ],
  ] as const) {
    const builderStart = dockerfile.indexOf("FROM installer AS builder");
    assert.notEqual(builderStart, -1, `${path} must define a builder stage`);

    const nextStage = dockerfile.indexOf("\nFROM ", builderStart + 1);
    const builderEnd = nextStage === -1 ? dockerfile.length : nextStage;
    const builderStage = dockerfile.slice(builderStart, builderEnd);
    const policyIndex = builderStage.indexOf(dependencyPolicy);
    const commandIndex = builderStage.indexOf(buildCommand);

    assert.notEqual(
      policyIndex,
      -1,
      `${path} must scope the policy to its builder`,
    );
    assert.notEqual(commandIndex, -1, `${path} must define its Turbo command`);
    assert.ok(
      policyIndex < commandIndex,
      `${path} must apply the policy before Turbo starts`,
    );

    const installerStart = dockerfile.indexOf("FROM base AS installer");
    const installerStage = dockerfile.slice(installerStart, builderStart);
    assert.equal(
      installerStage.includes(dependencyPolicy),
      false,
      `${path} must not leak the production policy into its dev target`,
    );
  }

  assert.match(
    apiDockerfile,
    /RUN DATABASE_URL=[^\n]+ \.\/node_modules\/\.bin\/prisma generate/u,
  );
  assert.match(
    apiDockerfile,
    /CMD \["\.\/node_modules\/\.bin\/prisma", "migrate", "deploy"\]/u,
  );
  assert.match(
    apiDockerfile,
    /RUN \.\/node_modules\/\.bin\/turbo build --filter=@customreport\/api/u,
  );
  assert.match(
    apiDockerfile,
    /RUN \/app\/node_modules\/\.bin\/playwright install --with-deps chromium/u,
  );
  assert.match(
    webDockerfile,
    /RUN \.\/node_modules\/\.bin\/turbo build --filter=@customreport\/web/u,
  );

  const migrateCommand =
    'command: ["./node_modules/.bin/prisma", "migrate", "deploy"]';
  for (const [path, compose] of [
    ["docker-compose.yml", devContent],
    ["docker-compose.prod.yml", content],
  ] as const) {
    const migrateStart = compose.indexOf("\n  migrate:\n");
    const apiStart = compose.indexOf("\n  api:\n", migrateStart);
    const migrateService = compose.slice(migrateStart, apiStart);
    assert.ok(
      migrateService.includes(migrateCommand),
      `${path} must start migration through the installed Prisma binary`,
    );
  }

  const forbiddenPnpmCommands = [
    "pnpm exec prisma",
    "pnpm exec playwright",
    "pnpm turbo",
    "pnpm run ",
  ] as const;
  for (const [path, dockerfile] of [
    ["Dockerfile.api", apiDockerfile],
    ["Dockerfile.web", webDockerfile],
  ] as const) {
    const commandLines = dockerfile
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("RUN ") || line.startsWith("CMD "));
    for (const forbidden of forbiddenPnpmCommands) {
      assert.equal(
        commandLines.some((line) => line.includes(forbidden)),
        false,
        `${path} must not invoke ${forbidden.trim()} after installation`,
      );
    }
  }
});

void test("production build stages make pnpm explicitly non-interactive", () => {
  for (const [path, dockerfile] of [
    ["Dockerfile.api", apiDockerfile],
    ["Dockerfile.web", webDockerfile],
  ] as const) {
    const installerStart = dockerfile.indexOf("FROM base AS installer");
    const inheritedStageStart = dockerfile.indexOf(
      "FROM installer AS",
      installerStart,
    );
    assert.notEqual(
      installerStart,
      -1,
      `${path} must define an installer stage`,
    );
    assert.notEqual(
      inheritedStageStart,
      -1,
      `${path} must inherit its build stage from installer`,
    );
    const installer = dockerfile.slice(installerStart, inheritedStageStart);
    assert.match(
      installer,
      /WORKDIR \/app\n(?:#[^\n]*\n)*ENV CI=true\n/u,
      `${path} must set CI=true inside the non-interactive installer stage`,
    );
    assert.ok(
      installer.indexOf("ENV CI=true") < installer.indexOf("pnpm install"),
      `${path} must set CI=true before pnpm install`,
    );
    assert.doesNotMatch(
      dockerfile.slice(0, installerStart),
      /^ENV [^\n]*\bCI=/mu,
      `${path} must not expose CI through the shared runtime base`,
    );
    const runnerStart = dockerfile.indexOf(" AS runner");
    assert.notEqual(runnerStart, -1, `${path} must define an app runner stage`);
    assert.doesNotMatch(
      dockerfile.slice(runnerStart),
      /^ENV [^\n]*\bCI=/mu,
      `${path} must not expose CI in the production app runner`,
    );
  }
});

void test("release labels do not invalidate heavyweight runner layers", () => {
  const apiRunner = apiDockerfile.slice(
    apiDockerfile.lastIndexOf("FROM ", apiDockerfile.indexOf(" AS runner")),
  );
  for (const [path, dockerfile] of [
    ["Dockerfile.api", apiDockerfile],
    ["Dockerfile.web", webDockerfile],
  ] as const) {
    const baseImage = /^FROM (node:\S+) AS base$/mu.exec(dockerfile)?.[1];
    const runnerImage = /^FROM (node:\S+) AS runner$/mu.exec(dockerfile)?.[1];
    assert.ok(baseImage, `${path} must define a pinned Node base image`);
    assert.equal(
      runnerImage,
      baseImage,
      `${path} runner must use the same Node image as its base`,
    );
  }
  assert.doesNotMatch(apiRunner, /COPY[^\n]*(?:pnpm|turbo)/);
  assert.ok(
    apiRunner.indexOf("LABEL org.opencontainers.image.revision=") >
      apiRunner.indexOf(
        "./node_modules/.bin/playwright install --with-deps chromium",
      ),
  );
  const webRunner = webDockerfile.slice(webDockerfile.indexOf(" AS runner"));
  assert.ok(
    webRunner.indexOf("LABEL org.opencontainers.image.revision=") >
      webRunner.lastIndexOf("COPY --from=builder"),
  );
});

void test("untracked environment variants stay ignored while examples remain tracked", () => {
  assert.match(gitIgnoreContent, /^\.env\.\*$/mu);
  assert.match(gitIgnoreContent, /^!\.env\.example$/mu);
  assert.match(gitIgnoreContent, /^!\.env\.test\.example$/mu);

  const git = resolveExecutable("git");
  const production = spawnSync(
    git,
    ["check-ignore", "--quiet", "--no-index", ".env.production"],
    { cwd: resolve("."), encoding: "utf8" },
  );
  const example = spawnSync(
    git,
    ["check-ignore", "--quiet", "--no-index", ".env.example"],
    { cwd: resolve("."), encoding: "utf8" },
  );
  assert.equal(production.status, 0, ".env.production must be ignored");
  assert.equal(example.status, 1, ".env.example must remain trackable");
});

void test("production services pool API connections and preserve direct paths", () => {
  assert.match(content, /POSTGRES_DB: \$\{POSTGRES_DB:\?/);
  assert.match(content, /DB_NAME: \$\{POSTGRES_DB:\?/);
  assert.match(content, /PGDATABASE: \$\{POSTGRES_DB:\?/);
  assert.match(content, /config-guard:/);
  assert.match(content, /\*\[!A-Za-z0-9\._~-\]\*/);
  assert.match(content, /\*\[!A-Za-z0-9_\]\*/);
  assert.match(content, /depends_on:[\s\S]*config-guard:/);
  assert.match(content, /postgresql:\/\/customreport:\$\{DB_PASSWORD:\?/);
  assert.match(
    content,
    /pgbouncer:[\s\S]*edoburu\/pgbouncer:v1\.25\.2-p0@sha256:[0-9a-f]{64}[\s\S]*POOL_MODE: transaction[\s\S]*healthcheck:[\s\S]*SELECT 1/u,
  );
  const migrationDatabaseUrl =
    /DATABASE_URL: postgresql:\/\/customreport:\$\{DB_PASSWORD:\?[^\n]+@postgres:5432\/\$\{POSTGRES_DB:\?[^\n]+/g;
  assert.equal([...content.matchAll(migrationDatabaseUrl)].length, 1);
  assert.match(
    content,
    /api:[\s\S]*DATABASE_URL: postgresql:\/\/customreport:[\s\S]*@pgbouncer:5432[\s\S]*depends_on:[\s\S]*pgbouncer:[\s\S]*condition: service_healthy[\s\S]*healthcheck:[\s\S]*health\/ready/u,
  );
  assert.match(
    content,
    /backup:[\s\S]*PGHOST: postgres[\s\S]*PGPORT: 5432[\s\S]*depends_on:[\s\S]*postgres:[\s\S]*condition: service_healthy/u,
  );
});

function assertReviewedExternalImage(path: string, image: string): void {
  const digestMarker = "@sha256:";
  const digestPosition = image.lastIndexOf(digestMarker);
  const digest = image.slice(digestPosition + digestMarker.length);
  const tagPosition = image.lastIndexOf(":", digestPosition);
  const repositoryPosition = image.lastIndexOf("/", digestPosition);
  assert.ok(
    digestPosition > 0 &&
      tagPosition > repositoryPosition &&
      /^[0-9a-f]{64}$/u.test(digest),
    `${path}: external image must include a readable tag and digest`,
  );
  const tag = image.slice(tagPosition + 1, digestPosition);
  assert.match(
    tag,
    /^v?\d+(?:\.\d+){1,2}(?:[-.][0-9A-Za-z][0-9A-Za-z.-]*)?$/u,
    `${path}: external image must use an explicit release tag`,
  );
  assert.ok(
    REVIEWED_EXTERNAL_IMAGES.has(image),
    `${path}: tag and digest must match a reviewed runtime release`,
  );
}

function classifyComposeImage(
  path: string,
  service: string,
  definition: { readonly build?: unknown; readonly image?: unknown },
): string | undefined {
  if (definition.image === undefined) return undefined;
  if (typeof definition.image !== "string") {
    assert.fail(`${path}: ${service} image must be a scalar`);
  }
  if (definition.build === undefined) return definition.image;

  const location = `${path}:${service}`;
  assert.equal(
    definition.image,
    REVIEWED_LOCAL_BUILD_IMAGES.get(location),
    `${location}: build plus image is allowed only for a reviewed repository-built image`,
  );
  return undefined;
}

void test("external Compose and CI images use versioned immutable references", () => {
  const composeSources = [
    ["docker-compose.yml", devContent],
    ["docker-compose.prod.yml", content],
    ["docker-compose.observability.yml", observabilityContent],
    ["docker-compose.errors.yml", errorsContent],
  ] as const;
  const externalImages: { path: string; image: string }[] = [];

  for (const [path, source] of composeSources) {
    const model = parse(source, { maxAliasCount: 50 }) as {
      readonly services?: Readonly<
        Record<string, { readonly build?: unknown; readonly image?: unknown }>
      >;
    };
    for (const [service, definition] of Object.entries(model.services ?? {})) {
      const image = classifyComposeImage(path, service, definition);
      if (image === undefined) continue;
      externalImages.push({
        path: `${path}:${service}`,
        image,
      });
    }
  }

  const workflowModel = parse(workflowContent, { maxAliasCount: 50 }) as {
    readonly jobs?: Readonly<
      Record<
        string,
        {
          readonly services?: Readonly<
            Record<string, { readonly image?: unknown }>
          >;
        }
      >
    >;
  };
  for (const [job, definition] of Object.entries(workflowModel.jobs ?? {})) {
    for (const [service, serviceDefinition] of Object.entries(
      definition.services ?? {},
    )) {
      if (typeof serviceDefinition.image !== "string") {
        assert.fail(
          `.github/workflows/ci.yml:${job}:${service} image must be a scalar`,
        );
      }
      externalImages.push({
        path: `.github/workflows/ci.yml:${job}:${service}`,
        image: serviceDefinition.image,
      });
    }
  }

  assert.ok(externalImages.length > 0);
  const observedImages = new Set<string>();
  for (const { path, image } of externalImages) {
    assertReviewedExternalImage(path, image);
    observedImages.add(image);
  }
  assert.deepEqual(observedImages, REVIEWED_EXTERNAL_IMAGES);
});

void test("external image policy rejects moving and mismatched references", () => {
  const digest = "a".repeat(64);
  const variableTag = "$" + "{TAG}";
  for (const image of [
    `redis:latest@sha256:${digest}`,
    `redis:stable@sha256:${digest}`,
    `redis:7-alpine@sha256:${digest}`,
    `redis:${variableTag}@sha256:${digest}`,
    `redis:7.4.11-alpine@sha256:${digest}`,
  ]) {
    assert.throws(() => assertReviewedExternalImage("probe", image));
  }
  assert.throws(() =>
    classifyComposeImage("docker-compose.yml", "planted", {
      build: ".",
      image: `redis:latest@sha256:${digest}`,
    }),
  );
});

void test("manual runtime smoke reclaims only reviewed application build space", () => {
  const workflowModel = parse(workflowContent, { maxAliasCount: 50 }) as {
    readonly jobs?: Readonly<
      Record<
        string,
        {
          readonly steps?: readonly {
            readonly name?: unknown;
            readonly if?: unknown;
            readonly run?: unknown;
          }[];
        }
      >
    >;
  };
  const steps = workflowModel.jobs?.["docker-build"]?.steps ?? [];
  const stepNames = steps.map(({ name }) => name);
  const releaseIdentityIndex = stepNames.indexOf(
    "Verify production image release identity",
  );
  const reclaimIndex = stepNames.indexOf(
    "Reclaim Docker build space before runtime smoke",
  );
  const runtimeIndex = stepNames.indexOf(
    "Verify PostgreSQL, pgvector, PgBouncer, Redis, and Caddy",
  );
  assert.ok(
    releaseIdentityIndex !== -1 &&
      releaseIdentityIndex < reclaimIndex &&
      reclaimIndex < runtimeIndex,
    "build outputs must be verified before their space is reclaimed for runtime smoke",
  );

  const reclaimStep = steps.at(reclaimIndex);
  assert.ok(reclaimStep);
  assert.equal(reclaimStep.if, "github.event_name == 'workflow_dispatch'");
  assert.equal(typeof reclaimStep.run, "string");
  const reclaimRun = reclaimStep.run as string;
  assert.match(reclaimRun, /for service in backup migrate api web/u);
  assert.match(
    reclaimRun,
    /docker image rm "customreport-\$\{service\}:\$\{OTEL_SERVICE_VERSION\}"/u,
  );
  assert.match(reclaimRun, /docker builder prune --all --force/u);
  assert.doesNotMatch(reclaimRun, /--volumes|docker system prune/u);
});

void test("Bugsink persists its SQLite database in the named data volume", () => {
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

void test("web health probes use the IPv4 address the standalone server binds", () => {
  assert.match(
    content,
    /web:[\s\S]*healthcheck:[\s\S]*http:\/\/127\.0\.0\.1:3000\//u,
  );
  assert.match(
    webDockerfile,
    /HEALTHCHECK[\s\S]*http:\/\/127\.0\.0\.1:3000\//u,
  );
  assert.doesNotMatch(webDockerfile, /http:\/\/localhost:3000\//u);
});

void test("Caddy health probes the IPv4 admin listener", () => {
  assert.match(
    content,
    /caddy:[\s\S]*healthcheck:[\s\S]*http:\/\/127\.0\.0\.1:2019\/config\//u,
  );
  assert.doesNotMatch(content, /http:\/\/localhost:2019\/config\//u);
});

void test("backup entrypoints are baked into the pinned image", () => {
  assert.match(
    content,
    /backup:[\s\S]*build:[\s\S]*context: \.\/deploy\/postgres/,
  );
  assert.doesNotMatch(
    content,
    /\.\/deploy\/postgres\/(?:backup-loop|backup-health|restore)\.sh:/,
  );
  assert.match(
    backupDockerfile,
    /FROM postgres:15\.19-alpine@sha256:fe0737ba566a2c5b2a28f34433c0a423261900ec17b9bf7ad115e1aae7e57f1b/,
  );
  assert.match(
    backupDockerfile,
    /COPY backup-loop\.sh backup-health\.sh restore\.sh \/usr\/local\/bin\//,
  );
});

// A real render check: with the policy matrix supplied the model renders;
// with every required var blank it must fail to render.
const renderComposeFiles = (
  composeFiles: readonly string[],
  env: NodeJS.ProcessEnv,
  format: "yaml" | "json" = "yaml",
) =>
  spawnSync(
    composeCommand.executable,
    [
      ...composeCommand.leadingArguments,
      ...composeFiles.flatMap((composeFile) => ["-f", composeFile]),
      "config",
      "--format",
      format,
    ],
    {
      env,
      encoding: "utf8",
    },
  );

const renderCompose = (
  env: NodeJS.ProcessEnv,
  format: "yaml" | "json" = "yaml",
) => renderComposeFiles([prodCompose], env, format);

const FULL_POLICY_ENV: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  DB_PASSWORD: "x",
  POSTGRES_DB: "customreport",
  DB_POOL_MAX: "10",
  DB_POOL_IDLE_TIMEOUT_MS: "10000",
  DB_POOL_CONNECTION_TIMEOUT_MS: "0",
  FRONTEND_URL: "http://x",
  APP_BASE_URL: "http://x",
  NEXT_PUBLIC_CLIENT_LOG_FORWARDING: "false",
  NEXT_PUBLIC_WEB_VITALS: "false",
  CLIENT_LOG_FORWARDING: "false",
  AUTH_JWT_SECRET: "x".repeat(32),
  PDF_EXPORT_JWT_SECRET: "x".repeat(32),
  PDF_BASE_URL: "http://x",
  AI_PROVIDER_CONFIG_ENCRYPTION_KEY: "x".repeat(32),
  AI_PROVIDER_CONFIG_KEY_VERSION: "1",
  AI_PROVIDER_ALLOWED_ORIGINS: "https://api.example.com",
  REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED: "false",
  REPORT_ASSISTANT_INPUT_VERSION: "1",
  REPORT_ASSISTANT_SIMILARITY_THRESHOLD: "0.55",
  REPORT_ASSISTANT_CANDIDATE_LIMIT: "500",
  REPORT_ASSISTANT_READ_THROUGH_LIMIT: "16",
  REPORT_ASSISTANT_EXHAUSTIVE_LIMIT: "200",
  REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET: "8000",
  REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS: "30000",
  REPORT_ASSISTANT_PLANNER_MAX_TOKENS: "1500",
  REPORT_ASSISTANT_ANSWER_MAX_TOKENS: "2000",
  REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE: "32",
  REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET: "8000",
  HEAP_HEALTH_THRESHOLD_BYTES: "1610612736",
  SMTP_HOST: "x",
  SMTP_PORT: "587",
  SMTP_FROM: "x",
  KEYCLOAK_SAML_CALLBACK_URL: "http://x",
  KEYCLOAK_SAML_ENTRY_POINT: "http://x",
  KEYCLOAK_SAML_ISSUER: "x",
  KEYCLOAK_SAML_CERT: "x",
  CADDY_SITE_ADDRESS: "http://x",
  CADDY_ACME_EMAIL: "ops@example.com",
  CADDY_CSP_REPORT_URI: "http://x",
  BACKUP_INTERVAL_SECONDS: "3600",
  BACKUP_RETENTION_DAYS: "14",
  PGBOUNCER_MAX_CLIENT_CONN: "100",
  PGBOUNCER_POOL_SIZE: "20",
  PGBOUNCER_RESERVE_POOL_SIZE: "5",
  LOG_LEVEL: "info",
  REDIS_DB: "0",
  OTEL_SDK_DISABLED: "true",
  OTEL_SERVICE_VERSION: "test-release",
  OTEL_TRACES_SAMPLER_ARG: "0",
  HTTP_PORT: "80",
  HTTPS_PORT: "443",
  HTTPS_PORT_QUIC: "443",
};

const LOCAL_ASSISTANT_POLICY_ENV: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  AI_PROVIDER_CONFIG_ENCRYPTION_KEY:
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  AI_PROVIDER_CONFIG_KEY_VERSION: "1",
  AI_PROVIDER_ALLOWED_ORIGINS:
    "https://api.mistral.ai,https://openrouter.ai,https://api.groq.com,https://api.jina.ai,https://api.openai.com",
  REPORT_ASSISTANT_INPUT_VERSION: "1",
  REPORT_ASSISTANT_SIMILARITY_THRESHOLD: "0.55",
  REPORT_ASSISTANT_CANDIDATE_LIMIT: "500",
  REPORT_ASSISTANT_READ_THROUGH_LIMIT: "16",
  REPORT_ASSISTANT_EXHAUSTIVE_LIMIT: "200",
  REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET: "8000",
  REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS: "30000",
  REPORT_ASSISTANT_PLANNER_MAX_TOKENS: "1500",
  REPORT_ASSISTANT_ANSWER_MAX_TOKENS: "2000",
  REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE: "32",
  REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET: "8000",
};

interface RenderedService {
  readonly command?: readonly string[];
  readonly environment?: Readonly<Record<string, string>>;
  readonly image?: string;
}

interface RenderedCompose {
  readonly services: Readonly<Record<string, RenderedService>>;
}

const renderComposeModel = (env: NodeJS.ProcessEnv): RenderedCompose => {
  const rendered = renderCompose(env, "json");
  assert.equal(rendered.status, 0, rendered.stderr);
  return JSON.parse(rendered.stdout) as RenderedCompose;
};

void test("every documented Compose lane supplies the required report-assistant environment", () => {
  const lanes = [
    ["local", [devCompose], { PATH: process.env.PATH }],
    [
      "source-watch",
      [devCompose, devOverrideCompose],
      LOCAL_ASSISTANT_POLICY_ENV,
    ],
    ["production", [prodCompose], FULL_POLICY_ENV],
  ] as const;
  const renderedLanes = new Map(
    lanes.map(([lane, composeFiles, environment]) => {
      const rendered = renderComposeFiles(composeFiles, environment, "json");
      assert.equal(rendered.status, 0, `${lane}: ${rendered.stderr}`);
      const model = JSON.parse(rendered.stdout) as RenderedCompose;
      const apiEnvironment = model.services.api?.environment;
      assert.ok(
        apiEnvironment !== undefined,
        `${lane}: api environment is absent`,
      );
      return [lane, apiEnvironment] as const;
    }),
  );
  assert.ok(REQUIRED_REPORT_ASSISTANT_ENV_KEYS.length > 0);

  for (const [lane, apiEnvironment] of renderedLanes) {
    for (const key of REQUIRED_REPORT_ASSISTANT_ENV_KEYS) {
      assert.ok(
        apiEnvironment[key] !== undefined,
        `${lane}: api environment must supply ${key}`,
      );
    }
    if (lane !== "production") {
      assert.equal(
        apiEnvironment.REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED,
        "false",
        `${lane}: report-derived outbound data must stay denied`,
      );
    }
  }
});

void test("every repository-built image carries the rendered release tag", () => {
  const model = renderComposeModel(FULL_POLICY_ENV);
  for (const service of ["backup", "migrate", "api", "web"] as const) {
    assert.equal(
      model.services[service]?.image,
      `customreport-${service}:test-release`,
    );
  }
});

void test("the rendered config guard rejects unsafe URL components without leaking them", () => {
  const model = renderComposeModel(FULL_POLICY_ENV);
  const command = model.services["config-guard"]?.command;
  assert.ok(command !== undefined);
  assert.deepEqual(command.slice(0, 2), ["sh", "-ec"]);
  const renderedGuard = command.at(2);
  assert.ok(typeof renderedGuard === "string");
  // `docker compose config` preserves the escaped dollars for a round trip;
  // the engine sends one dollar to the container command.
  const guard = renderedGuard.replaceAll("$$", "$");

  for (const [password, database, expectedStatus] of [
    ["safe.pass_~-", "customreport_production", 0],
    ["unsafe@pass", "customreport_production", 1],
    ["safe_pass", "unsafe/name", 1],
    ["safe_pass", "unsafe-name", 1],
  ] as const) {
    const checked = spawnSync("/bin/sh", ["-ec", guard], {
      env: { DB_PASSWORD: password, POSTGRES_DB: database },
      encoding: "utf8",
    });
    assert.equal(checked.status, expectedStatus);
    const output = `${checked.stdout}${checked.stderr}`;
    assert.doesNotMatch(output, new RegExp(password));
    assert.doesNotMatch(output, new RegExp(database));
  }
});

void test("production compose renders with the full policy matrix", () => {
  const rendered = renderCompose(FULL_POLICY_ENV);
  assert.equal(rendered.status, 0, rendered.stderr);
  for (const variable of REQUIRED_POLICY_INPUTS) {
    assert.match(
      workflowContent,
      new RegExp(`^      ${variable}:`, "mu"),
      `CI Docker build must provide ${variable}`,
    );
  }
});

void test("production Web uses one Compose-owned API origin in both phases", () => {
  assert.equal(
    [...content.matchAll(/^[ \t]+API_URL: \*production-api-url$/gmu)].length,
    2,
    "the Web build args and runtime environment must share the named API URL anchor",
  );
  assert.doesNotMatch(
    content,
    /\$\{API_URL[:}]/u,
    "production Web API_URL must not be operator-overridable",
  );
  assert.doesNotMatch(
    productionEnvironment,
    /^API_URL=/mu,
    "API_URL must not be a production operator input",
  );
});

void test("production compose refuses to render with a blank required input", () => {
  // Blank every required var: compose must exit nonzero instead of inventing
  // operational policy. A handful are exempted as documented optional
  // integrations (OTEL_EXPORTER_OTLP_ENDPOINT, SMTP_USER/PASS, SENTRY_DSN,
  // FRONTEND_URLS).
  const blanked = renderCompose({ PATH: process.env.PATH });
  assert.notEqual(blanked.status, 0);
  assert.match(`${blanked.stdout}${blanked.stderr}`, /required|must be set/i);
});
