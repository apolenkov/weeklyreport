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
import { dirname, join, resolve } from "node:path";

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
  readonly variables?: Readonly<Record<string, string>>;
  readonly needs?: readonly (string | { readonly job: string })[];
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

const workspaces = new Set<string>();
afterEach(() => {
  for (const root of workspaces) {
    rmSync(root, { recursive: true, force: true });
  }
  workspaces.clear();
});

const fixtureToken = "job-token-fixture";
const robotToken = "robot-fixture";

const BUILD_ENV = {
  CI_COMMIT_SHA: "0123456789abcdef",
  CI_REGISTRY_IMAGE: "registry.example.com/group/project",
  CI_REGISTRY_USER: "gitlab-ci-token",
  CI_REGISTRY_PASSWORD: fixtureToken,
  WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING: "false",
  WR_NEXT_PUBLIC_WEB_VITALS: "false",
  WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED: "false",
  WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES: "admin",
};

const BUILDCTL_STUB = String.raw`#!/bin/sh
printf '%s\n' "$*" >> "$STUB_CALLS"
while [ "$#" -gt 0 ]; do
  [ "$1" = --metadata-file ] && meta="$2"
  shift
done
printf '{"containerimage.digest": "sha256:%064d"}' 1 > "$meta"
`;

function runBuildScript(env: Readonly<Record<string, string | undefined>>) {
  const directory = mkdtempSync(join(tmpdir(), "ci-image-build-"));
  workspaces.add(directory);
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const stub = join(bin, "buildctl-daemonless.sh");
  writeFileSync(stub, BUILDCTL_STUB);
  chmodSync(stub, 0o755);
  const calls = join(directory, "calls.log");
  writeFileSync(calls, "");
  const result = spawnSync("/bin/sh", ["-c", buildJob.script[0] ?? ""], {
    cwd: directory,
    env: {
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      CI_PROJECT_DIR: directory,
      STUB_CALLS: calls,
      ...env,
    },
    encoding: "utf8",
  });
  return {
    result,
    calls: readFileSync(calls, "utf8").split("\n").filter(Boolean),
    digests: join(directory, "image-digests.txt"),
  };
}

test("the build job fails before building when the registry cannot be resolved", () => {
  const { result, calls } = runBuildScript({
    ...BUILD_ENV,
    CI_REGISTRY_IMAGE: undefined,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /IMAGE_REGISTRY/);
  assert.deepEqual(calls, []);
});

test("the build job fails before building when a web build value is missing", () => {
  const { result, calls } = runBuildScript({
    ...BUILD_ENV,
    WR_NEXT_PUBLIC_WEB_VITALS: undefined,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /WR_NEXT_PUBLIC_WEB_VITALS/);
  assert.deepEqual(calls, []);
});

test("the build job pushes four SHA-tagged images and records their digests", () => {
  const { result, calls, digests } = runBuildScript(BUILD_ENV);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(calls.length, 4);
  const registry = "registry.example.com/group/project";
  for (const name of ["api", "migrate", "web", "backup"]) {
    assert.ok(
      calls.some((call) =>
        call.includes(`name=${registry}/${name}:0123456789abcdef,push=true`),
      ),
      `${name} was not pushed with the commit SHA tag`,
    );
  }
  assert.ok(calls.some((call) => call.includes("target=migrator")));
  const webBuild = calls.find((call) =>
    call.includes(`name=${registry}/web:0123456789abcdef,push=true`),
  );
  assert.ok(webBuild, "the web image must be built");
  for (const argument of [
    "API_URL=http://api:3001",
    `NEXT_PUBLIC_APP_VERSION=${BUILD_ENV.CI_COMMIT_SHA}`,
    "NEXT_PUBLIC_AUTH_STUB=false",
    "NEXT_PUBLIC_DEV_ROLE_SWITCHER=false",
    `NEXT_PUBLIC_CLIENT_LOG_FORWARDING=${BUILD_ENV.WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING}`,
    `NEXT_PUBLIC_WEB_VITALS=${BUILD_ENV.WR_NEXT_PUBLIC_WEB_VITALS}`,
    `NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED=${BUILD_ENV.WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED}`,
    `NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES=${BUILD_ENV.WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES}`,
  ]) {
    assert.ok(webBuild.includes(`build-arg:${argument}`), argument);
  }
  assert.equal(readFileSync(digests, "utf8").trim().split("\n").length, 4);
  assert.doesNotMatch(
    result.stdout + result.stderr,
    new RegExp(BUILD_ENV.CI_REGISTRY_PASSWORD),
  );
  // The build context is the project dir (`--local context=.`), so registry
  // credentials must never land inside it.
  assert.equal(existsSync(join(dirname(digests), ".registry-auth")), false);
});

test("IMAGE_REGISTRY overrides the project registry", () => {
  const { result, calls } = runBuildScript({
    ...BUILD_ENV,
    IMAGE_REGISTRY: "other.example.com/team",
    IMAGE_REGISTRY_USER: "robot",
    IMAGE_REGISTRY_PASSWORD: robotToken,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(
    calls.every((call) => call.includes("name=other.example.com/team/")),
  );
});

test("the build job disables the OCI process sandbox for a confined runner", () => {
  assert.equal(
    buildJob.variables?.BUILDKITD_FLAGS,
    "--oci-worker-no-process-sandbox",
  );
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
  assert.match(active[0]?.if ?? "", /\$KUBECONFIG/);
  assert.match(active[0]?.if ?? "", /\$CI_DEFAULT_BRANCH/);
  assert.equal(active[0]?.when, "manual");
  assert.equal(rules.at(-1)?.when, "never");
  // The install/upgrade command contract lives in deploy-production.test.ts.
  assert.match(deployJob.script.join("\n"), /images\.tag=\$CI_COMMIT_SHA/);
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
