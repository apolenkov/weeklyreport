import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";

import { test } from "vitest";

const read = (path: string): string => readFileSync(resolve(path), "utf8");
const dockerIgnore = resolve(".dockerignore");
const dockerIgnoreContent = read(".dockerignore");
const apiDockerfile = read("Dockerfile.api");
const webDockerfile = read("Dockerfile.web");
const backupDockerfile = read("deploy/postgres/Dockerfile.backup");
const gitIgnoreContent = read(".gitignore");
const turboConfig = JSON.parse(read("turbo.json")) as {
  readonly globalEnv?: readonly string[];
};

test("Docker build context excludes TypeScript test harnesses", () => {
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

test("Docker build context retains the production-prune self-test", () => {
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

test("the production image receives one release identity", () => {
  for (const dockerfile of [apiDockerfile, webDockerfile, backupDockerfile]) {
    assert.match(
      dockerfile,
      /LABEL org\.opencontainers\.image\.revision=\$\{/u,
    );
  }
});

test("production dependency layers retain a shared pnpm BuildKit cache", () => {
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

test("production builders carry the complete dist gate policy", () => {
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

test("the migrator target contains only the canonical migration runtime", () => {
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
  assert.match(migrator, /test ! -e \/app\/node_modules\/@weeklyreport/u);
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

test("the API runner excludes migration-only tooling", () => {
  assert.match(
    apiDockerfile,
    /pnpm --filter=@weeklyreport\/api deploy --prod --legacy --frozen-lockfile --ignore-scripts \/tmp\/api-deps/u,
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
    /test ! -e \/app\/node_modules\/@weeklyreport\/migrator-runtime/u,
  );
  assert.match(runner, /find \/app\/node_modules\/\.pnpm -maxdepth 1 -type d/u);
  assert.match(
    runner,
    /@typescript\+typescript6@\*/u,
    "the API runner must reject the aliased TypeScript compiler payload",
  );
});

test("the API runner CMD resolves its emitted entrypoint from WORKDIR", () => {
  const runner = apiDockerfile.slice(apiDockerfile.indexOf(" AS runner"));
  const workdir = /^WORKDIR (\S+)$/mu.exec(runner)?.[1];
  assert.equal(workdir, "/app", "the API runner must declare its WORKDIR");
  const distCopy =
    /^COPY --from=builder --chown=node:node \S+ (\.\/\S+)$/mu.exec(runner)?.[1];
  assert.ok(distCopy, "the runner must copy the built API dist tree");
  const cmd = /^CMD \["node", "([^"]+)"\]$/mu.exec(runner)?.[1];
  assert.ok(cmd, "the API runner must start node in exec form");
  assert.equal(
    resolve(workdir, cmd),
    resolve(workdir, distCopy, "apps/api/src/main.js"),
    "the runner CMD must point at the emitted entrypoint under its dist destination",
  );
});

test("post-install production tools bypass pnpm dependency preflight", () => {
  assert.ok(
    turboConfig.globalEnv?.includes("PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN"),
  );

  const dependencyPolicy = "ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false";
  for (const [path, dockerfile, buildCommand] of [
    [
      "Dockerfile.api",
      apiDockerfile,
      "RUN ./node_modules/.bin/turbo build --filter=@weeklyreport/api",
    ],
    [
      "Dockerfile.web",
      webDockerfile,
      "RUN ./node_modules/.bin/turbo build --filter=@weeklyreport/web",
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
    /RUN \.\/node_modules\/\.bin\/turbo build --filter=@weeklyreport\/api/u,
  );
  assert.match(
    webDockerfile,
    /RUN \.\/node_modules\/\.bin\/turbo build --filter=@weeklyreport\/web/u,
  );

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

test("production build stages make pnpm explicitly non-interactive", () => {
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

test("release labels do not invalidate heavyweight runner layers", () => {
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
        "COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules",
      ),
    "the release label must follow the heavyweight production dependency layer",
  );
  assert.ok(
    apiRunner.indexOf("LABEL org.opencontainers.image.revision=") >
      apiRunner.lastIndexOf("COPY --from="),
    "the release label must follow the last runner build-output copy",
  );
  const webRunner = webDockerfile.slice(webDockerfile.indexOf(" AS runner"));
  assert.ok(
    webRunner.indexOf("LABEL org.opencontainers.image.revision=") >
      webRunner.lastIndexOf("COPY --from=builder"),
  );
});

test("untracked environment variants stay ignored while examples remain tracked", () => {
  assert.match(gitIgnoreContent, /^\.env\.\*$/mu);
  assert.match(gitIgnoreContent, /^!\.env\.example$/mu);
  assert.match(gitIgnoreContent, /^!\.env\.test\.example$/mu);

  const git = (process.env.PATH ?? "")
    .split(delimiter)
    .map((directory) => join(directory, "git"))
    .find(existsSync);
  assert.ok(git, "git is required for the environment-ignore contract");
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

test("web health probes use the IPv4 address the standalone server binds", () => {
  assert.match(
    webDockerfile,
    /HEALTHCHECK[\s\S]*http:\/\/127\.0\.0\.1:3000\//u,
  );
  assert.doesNotMatch(webDockerfile, /http:\/\/localhost:3000\//u);
});

test("backup entrypoints are baked into the pinned image", () => {
  assert.match(
    backupDockerfile,
    /FROM postgres:16\.15-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea/,
  );
  assert.match(
    backupDockerfile,
    /COPY backup-loop\.sh backup-health\.sh restore\.sh \/usr\/local\/bin\//,
  );
});

test("the standalone API image checks readiness after its bootstrap budget", () => {
  const healthcheck = /^HEALTHCHECK[^\n]*\\\n[^\n]+/mu.exec(apiDockerfile)?.[0];
  assert.ok(healthcheck, "the API image must define a healthcheck");
  assert.match(
    healthcheck,
    /http:\/\/(?:127\.0\.0\.1|localhost):3001\/health\/ready/u,
  );
  const startPeriod = /--start-period=(\d+)s/u.exec(healthcheck)?.[1];
  assert.ok(startPeriod !== undefined && Number(startPeriod) >= 60);
});
