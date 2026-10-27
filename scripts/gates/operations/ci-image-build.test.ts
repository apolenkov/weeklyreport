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
import { dirname, join, resolve, sep } from "node:path";

import { afterEach, test } from "vitest";
import { parse } from "yaml";

interface Rule {
  readonly if?: string;
  readonly when?: string;
  readonly allow_failure?: boolean;
}

interface Job {
  readonly script: readonly string[];
  readonly rules: readonly Rule[];
  readonly image?:
    | string
    | { readonly name?: string; readonly entrypoint?: readonly string[] };
  readonly variables?: Readonly<Record<string, string>>;
  readonly needs?: readonly (string | { readonly job: string })[];
  readonly interruptible?: boolean;
  readonly resource_group?: string;
}

const jobs = parse(readFileSync(resolve(".gitlab-ci.yml"), "utf8"), {
  maxAliasCount: 50,
}) as Record<string, Job | undefined>;

function requireJob(name: string): Job {
  const job = jobs[name];
  if (job === undefined) {
    throw new Error(`.gitlab-ci.yml has no ${name} job`);
  }
  return job;
}

const buildJob = requireJob("build-images");
const deployJob = requireJob("deploy-production");

// The `yaml` package accepts a bare `- : "text"` list item as a one-key
// mapping, but GitLab's parser rejects the whole file; every script entry
// must therefore be a string or a `!reference` array.
test("every CI script entry is a string GitLab can parse", () => {
  for (const [name, job] of Object.entries(jobs)) {
    for (const key of ["before_script", "script", "after_script"]) {
      const lines = (job as Record<string, unknown> | undefined)?.[key];
      if (!Array.isArray(lines)) continue;
      for (const entry of lines) {
        // `!reference [...]` parses as an array; a one-key mapping does not.
        assert.ok(
          typeof entry === "string" || Array.isArray(entry),
          `${name}.${key} has an entry GitLab cannot parse`,
        );
      }
    }
  }
});

// The internal Docker Hub mirror every external base image is rewritten to.
const BASE_REGISTRY = "mirror.example.org/all-pub-docker";
// buildah 1.43.5: the version the new runner was probed with.
const BUILDAH_IMAGE = `${BASE_REGISTRY}/buildah/stable:v1.43.5@sha256:87f219f5a7bf5d7bee870253c14a57751e85833cb2cc645216a20bbb66c68724`;

const workspaces = new Set<string>();
afterEach(() => {
  for (const root of workspaces) {
    rmSync(root, { recursive: true, force: true });
  }
  workspaces.clear();
});

const fixtureToken = "job-token-fixture";
const robotToken = "robot-fixture";
const commitSha = "0123456789abcdef";

const BUILD_ENV = {
  CI_COMMIT_SHA: commitSha,
  CI_REGISTRY_IMAGE: "registry.example.com/group/project",
  CI_REGISTRY_USER: "gitlab-ci-token",
  CI_REGISTRY_PASSWORD: fixtureToken,
  BASE_REGISTRY,
  WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING: "false",
  WR_NEXT_PUBLIC_WEB_VITALS: "false",
  WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED: "false",
  WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES: "admin",
} as const;

// Stands in for the buildah CLI: records the invocation, captures the mirrored
// Dockerfile passed to `bud`, drains the password from `login`, and answers
// `push --digestfile` with a deterministic digest.
const BUILDAH_STUB = String.raw`#!/bin/sh
printf '%s\n' "$*" >> "$STUB_CALLS"
command="$1"
shift
case "$command" in
  login)
    while IFS= read -r ignore; do :; done
    ;;
  bud)
    [ -e "$CI_PROJECT_DIR/image-digests.txt" ] && printf 'present\n' >> "$STUB_CONTEXT_LEAKS"
    previous=""
    for argument in "$@"; do
      [ "$previous" = "-f" ] && cp "$argument" "$STUB_FILES/$(basename "$argument")"
      previous="$argument"
    done
    ;;
  push)
    previous=""
    for argument in "$@"; do
      [ "$previous" = "--digestfile" ] && printf 'sha256:%064d\n' 1 > "$argument"
      previous="$argument"
    done
    ;;
esac
exit 0
`;

// Repository Dockerfiles the job builds, relative to the project root.
const DOCKERFILES = [
  "Dockerfile.api",
  "Dockerfile.web",
  "deploy/postgres/Dockerfile.backup",
] as const;

const fileName = (path: string): string =>
  path.slice(path.lastIndexOf("/") + 1);

interface ScriptRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

interface BuildRun {
  readonly result: ScriptRun;
  readonly calls: readonly string[];
  readonly contextLeaks: string;
  readonly project: string;
  readonly mirrored: string;
  readonly digests: string;
}

function writeProjectDockerfiles(project: string): void {
  for (const path of DOCKERFILES) {
    const target = join(project, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(resolve(path), "utf8"));
  }
}

function runBuildScript(
  env: Readonly<Record<string, string | undefined>>,
  dockerfileOverrides: Readonly<Record<string, string>> = {},
): BuildRun {
  const workspace = mkdtempSync(join(tmpdir(), "ci-image-build-"));
  workspaces.add(workspace);
  const project = join(workspace, "project");
  mkdirSync(project);
  writeProjectDockerfiles(project);
  for (const [path, content] of Object.entries(dockerfileOverrides)) {
    const target = join(project, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  const bin = join(workspace, "bin");
  mkdirSync(bin);
  const stub = join(bin, "buildah");
  writeFileSync(stub, BUILDAH_STUB);
  chmodSync(stub, 0o755);
  const mirrored = join(workspace, "mirrored");
  mkdirSync(mirrored);
  const calls = join(workspace, "calls.log");
  writeFileSync(calls, "");
  const contextLeaks = join(workspace, "context-leaks.log");
  writeFileSync(contextLeaks, "");
  const result = spawnSync("/bin/sh", ["-c", buildJob.script[0] ?? ""], {
    cwd: project,
    env: {
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      CI_PROJECT_DIR: project,
      STUB_CALLS: calls,
      STUB_CONTEXT_LEAKS: contextLeaks,
      STUB_FILES: mirrored,
      ...env,
    },
    encoding: "utf8",
  });
  return {
    result: {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    },
    calls: readFileSync(calls, "utf8").split("\n").filter(Boolean),
    contextLeaks: readFileSync(contextLeaks, "utf8").trim(),
    project,
    mirrored,
    digests: join(project, "image-digests.txt"),
  };
}

const argumentsOf = (call: string): readonly string[] => call.split(" ");

const argumentAfter = (call: string, flag: string): string | undefined => {
  const values = argumentsOf(call);
  const index = values.indexOf(flag);
  return index === -1 ? undefined : values[index + 1];
};

const callsFor = (
  calls: readonly string[],
  command: string,
): readonly string[] => calls.filter((call) => call.startsWith(`${command} `));

const isOutsideProject = (project: string, path: string): boolean =>
  resolve(path) !== resolve(project) &&
  !resolve(path).startsWith(`${resolve(project)}${sep}`);

// Every external base image in a repository Dockerfile is a pinned
// `tag@sha256` reference; the job must swap its registry for the mirror and
// leave stage references alone.
function assertMirroredDockerfile(
  source: string,
  mirrored: string,
  path: string,
): void {
  const sourceRows = source.split("\n");
  const mirroredRows = mirrored.split("\n");
  assert.equal(mirroredRows.length, sourceRows.length, `${path}: line count`);
  const externalImages: string[] = [];
  for (const [index, line] of sourceRows.entries()) {
    if (!line.startsWith("FROM ")) {
      assert.equal(mirroredRows[index], line, `${path}: non-FROM line changed`);
      continue;
    }
    const image = (/^FROM (\S+)/u.exec(line)?.[1] ?? "").trim();
    assert.ok(image.length > 0, `${path}: unreadable FROM`);
    if (!image.includes(":")) {
      // A stage reference such as `FROM base AS installer`.
      assert.equal(
        mirroredRows[index],
        line,
        `${path}: stage reference changed`,
      );
      continue;
    }
    externalImages.push(image);
    const expected = image.includes("/")
      ? `${BASE_REGISTRY}/${image}`
      : `${BASE_REGISTRY}/library/${image}`;
    assert.ok(
      mirroredRows[index]?.startsWith(`FROM ${expected}`),
      `${path}: ${image} was not rewritten through the mirror`,
    );
  }
  assert.ok(
    externalImages.length > 0,
    `${path} must pin an external base image`,
  );
}

test("the build job runs on the pinned buildah image with an unprivileged store", () => {
  const image = buildJob.image;
  assert.equal(typeof image, "object");
  assert.equal(
    typeof image === "object" ? image.name : undefined,
    BUILDAH_IMAGE,
  );
  assert.equal(buildJob.variables?.BUILDKITD_FLAGS, undefined);
  assert.deepEqual(buildJob.variables, {
    STORAGE_DRIVER: "vfs",
    BUILDAH_ISOLATION: "chroot",
    BASE_REGISTRY,
  });
  const script = buildJob.script.join("\n");
  assert.match(script, /buildah bud /u);
  assert.doesNotMatch(script, /buildctl|rootless/iu);
  assert.doesNotMatch(
    readFileSync(resolve(".gitlab-ci.yml"), "utf8"),
    /buildkit/iu,
  );
});

test("the build job fails before building when the registry cannot be resolved", () => {
  const { result, calls } = runBuildScript({
    ...BUILD_ENV,
    CI_REGISTRY_IMAGE: undefined,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /IMAGE_REGISTRY/u);
  assert.deepEqual(calls, []);
});

test("the build job fails before building when registry credentials are missing", () => {
  const { result, calls } = runBuildScript({
    ...BUILD_ENV,
    CI_REGISTRY_USER: undefined,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /IMAGE_REGISTRY_USER/u);
  assert.deepEqual(calls, []);
});

test("the build job fails before building when a web build value is missing", () => {
  const { result, calls } = runBuildScript({
    ...BUILD_ENV,
    WR_NEXT_PUBLIC_WEB_VITALS: undefined,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /WR_NEXT_PUBLIC_WEB_VITALS/u);
  assert.deepEqual(calls, []);
});

test("the build job fails before building when a base image escapes the mirror", () => {
  const baseVariable = "$" + "{BASE}";
  const { result, calls } = runBuildScript(BUILD_ENV, {
    "deploy/postgres/Dockerfile.backup": [
      "ARG BASE=quay.io",
      `FROM ${baseVariable}/buildah/stable:1.0 AS base`,
      "",
    ].join("\n"),
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /not mirrored: \$\{BASE\}\/buildah\/stable:1\.0/u,
  );
  assert.deepEqual(calls, []);
});

test("the build job fails closed instead of remapping a foreign registry", () => {
  const { result, calls } = runBuildScript(BUILD_ENV, {
    "deploy/postgres/Dockerfile.backup":
      "FROM quay.io/buildah/stable:1.0 AS base\n",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not mirrored: quay\.io\/buildah\/stable:1\.0/u);
  assert.deepEqual(calls, []);
});

test("the build job rewrites every base image through the internal mirror", () => {
  const { result, mirrored } = runBuildScript(BUILD_ENV);
  assert.equal(result.status, 0, result.stderr);
  for (const path of DOCKERFILES) {
    assertMirroredDockerfile(
      readFileSync(resolve(path), "utf8"),
      readFileSync(join(mirrored, fileName(path)), "utf8"),
      path,
    );
  }
});

test("the build job pushes four SHA-tagged images and records their digests", () => {
  const { result, calls, contextLeaks, project, digests } =
    runBuildScript(BUILD_ENV);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    contextLeaks,
    "",
    "image-digests.txt must stay out of the build context while images build",
  );
  assert.equal(callsFor(calls, "login").length, 1);
  assert.equal(callsFor(calls, "bud").length, 4);
  assert.equal(callsFor(calls, "push").length, 4);
  assert.equal(callsFor(calls, "rmi").length, 4);

  const registry = "registry.example.com/group/project";
  for (const name of ["api", "migrate", "web", "backup"]) {
    const image = `${registry}/${name}:${commitSha}`;
    const bud = callsFor(calls, "bud").find((call) =>
      argumentsOf(call).includes(image),
    );
    assert.ok(bud, `${name} was not built with the commit SHA tag`);
    const budArguments = argumentsOf(bud);
    assert.ok(budArguments.includes("--layers"), `${name} must cache layers`);
    const format = argumentAfter(bud, "--format");
    assert.equal(format, "docker", `${name} must keep the Docker v2 manifest`);
    const dockerfile = argumentAfter(bud, "-f");
    assert.ok(
      dockerfile !== undefined && isOutsideProject(project, dockerfile),
      `${name} must build from a job-local mirrored Dockerfile`,
    );
    const push = callsFor(calls, "push").find(
      (call) => call.includes(" --digestfile ") && call.includes(image),
    );
    assert.ok(push, `${name} was not pushed with the commit SHA tag`);
    assert.ok(
      push.includes(`docker://${image}`),
      `${name} must push to the registry reference explicitly`,
    );
    assert.ok(
      calls.includes(`rmi ${image}`),
      `${name} was not removed after publication`,
    );
  }

  const migrate = callsFor(calls, "bud").find((call) =>
    call.includes(`/migrate:${commitSha}`),
  );
  assert.ok(migrate?.includes("--target migrator"));
  const web = callsFor(calls, "bud").find((call) =>
    call.includes(`/web:${commitSha}`),
  );
  assert.ok(web, "the web image must be built");
  for (const argument of [
    "API_URL=http://api:3001",
    `NEXT_PUBLIC_APP_VERSION=${commitSha}`,
    "NEXT_PUBLIC_AUTH_STUB=false",
    "NEXT_PUBLIC_DEV_ROLE_SWITCHER=false",
    `NEXT_PUBLIC_CLIENT_LOG_FORWARDING=${BUILD_ENV.WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING}`,
    `NEXT_PUBLIC_WEB_VITALS=${BUILD_ENV.WR_NEXT_PUBLIC_WEB_VITALS}`,
    `NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED=${BUILD_ENV.WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED}`,
    `NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES=${BUILD_ENV.WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES}`,
  ]) {
    assert.ok(web.includes(` --build-arg ${argument}`), argument);
  }
  for (const name of ["api", "backup", "migrate"]) {
    const call = callsFor(calls, "bud").find((candidate) =>
      candidate.includes(`/${name}:${commitSha}`),
    );
    assert.ok(
      call?.includes(` --build-arg BUILD_VERSION=${commitSha}`),
      `${name} must receive the release identity`,
    );
  }

  const recorded = readFileSync(digests, "utf8").trim().split("\n");
  assert.equal(recorded.length, 4);
  for (const name of ["api", "migrate", "web", "backup"]) {
    assert.ok(
      recorded.includes(
        `${name}=${registry}/${name}@sha256:${"0".repeat(63)}1`,
      ),
      `${name} digest is missing from image-digests.txt`,
    );
  }
  assert.doesNotMatch(
    result.stdout + result.stderr,
    new RegExp(BUILD_ENV.CI_REGISTRY_PASSWORD),
  );
});

test("registry credentials stay outside the build context and are never printed", () => {
  const { result, calls, project } = runBuildScript(BUILD_ENV);
  assert.equal(result.status, 0, result.stderr);
  const login = callsFor(calls, "login")[0];
  assert.ok(login, "the job must log in to the registry");
  assert.ok(login.includes(`--username ${BUILD_ENV.CI_REGISTRY_USER}`));
  assert.match(login, /--password-stdin/u);
  const authFile = argumentAfter(login, "--authfile");
  assert.ok(authFile, "the login must name its auth file");
  assert.ok(
    isOutsideProject(project, authFile),
    "the auth file must stay outside $CI_PROJECT_DIR",
  );
  assert.equal(existsSync(join(project, "auth.json")), false);
  assert.equal(existsSync(join(project, ".docker")), false);
  for (const call of calls) {
    assert.equal(call.includes(BUILD_ENV.CI_REGISTRY_PASSWORD), false);
  }
  for (const path of DOCKERFILES) {
    assert.equal(
      readFileSync(join(project, path), "utf8"),
      readFileSync(resolve(path), "utf8"),
      `${path} must stay unchanged on disk`,
    );
  }
});

test("IMAGE_REGISTRY overrides the project registry", () => {
  const { result, calls } = runBuildScript({
    ...BUILD_ENV,
    IMAGE_REGISTRY: "other.example.com/team",
    IMAGE_REGISTRY_USER: "robot",
    IMAGE_REGISTRY_PASSWORD: robotToken,
  });
  assert.equal(result.status, 0, result.stderr);
  const login = callsFor(calls, "login")[0];
  assert.ok(
    login?.includes(" other.example.com"),
    "login must use the override",
  );
  assert.ok(
    callsFor(calls, "push").every((call) =>
      call.includes("other.example.com/team/"),
    ),
  );
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(robotToken));
});

test("merge requests only offer the build manually and never fail the pipeline", () => {
  const rule = buildJob.rules.find((candidate) =>
    candidate.if?.includes("merge_request_event"),
  );
  assert.deepEqual([rule?.when, rule?.allow_failure], ["manual", true]);
});

test("the deploy job exists only with a kubeconfig, manually, on the default branch", () => {
  const rules = deployJob.rules;
  const active = rules.filter((rule) => rule.when !== "never");
  assert.equal(active.length, 1);
  assert.match(active[0]?.if ?? "", /\$KUBECONFIG/u);
  assert.match(active[0]?.if ?? "", /\$CI_DEFAULT_BRANCH/u);
  assert.equal(active[0]?.when, "manual");
  assert.equal(rules.at(-1)?.when, "never");
  // The install/upgrade command contract lives in deploy-production.test.ts.
  assert.match(deployJob.script.join("\n"), /images\.tag=\$CI_COMMIT_SHA/u);
  // A deploy must wait for this pipeline's image build, when it has one.
  assert.deepEqual(deployJob.needs, [{ job: "build-images" }]);
});

test("every job runs on the img-build runner and deploy jobs are serialised", () => {
  const config = parse(readFileSync(resolve(".gitlab-ci.yml"), "utf8"), {
    maxAliasCount: 50,
  }) as Record<string, Record<string, unknown>> & {
    readonly default: Record<string, unknown>;
  };
  const defaults = config.default;
  assert.deepEqual(defaults.tags, ["img-build"]);
  assert.equal(defaults.interruptible, true);
  const reserved = new Set(["workflow", "default", "stages", "variables"]);
  for (const [name, job] of Object.entries(config)) {
    if (name.startsWith(".") || reserved.has(name)) continue;
    assert.deepEqual(job.tags ?? defaults.tags, ["img-build"], name);
  }
  assert.ok(config["build-images"]?.resource_group, "build-images group");
  assert.ok(config["deploy-production"]?.resource_group, "deploy group");
});

test("only the image build and production deploy jobs are not interruptible", () => {
  const config = parse(readFileSync(resolve(".gitlab-ci.yml"), "utf8"), {
    maxAliasCount: 50,
  }) as Record<string, Record<string, unknown>> & {
    readonly default: Record<string, unknown>;
  };
  const reserved = new Set(["workflow", "default", "stages", "variables"]);
  const uninterruptible = new Set(["build-images", "deploy-production"]);
  for (const name of uninterruptible) {
    assert.equal(config[name]?.interruptible, false, `${name} interruptible`);
  }
  for (const [name, job] of Object.entries(config)) {
    if (name.startsWith(".") || reserved.has(name)) continue;
    if (uninterruptible.has(name)) continue;
    assert.equal(
      job.interruptible ?? config.default.interruptible,
      true,
      `${name} interruptible`,
    );
  }
});

test("CI contains only build and deployment jobs", () => {
  const reserved = new Set(["workflow", "default", "stages", "variables"]);
  assert.deepEqual(
    Object.keys(jobs)
      .filter((name) => !reserved.has(name))
      .sort(),
    ["build-images", "deploy-production"],
  );
});
