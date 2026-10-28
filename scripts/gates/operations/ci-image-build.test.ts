import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "vitest";
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

const deployJob = requireJob("deploy-production");

test("every CI script entry is a string GitLab can parse", () => {
  for (const [name, job] of Object.entries(jobs)) {
    for (const key of ["before_script", "script", "after_script"]) {
      const lines = (job as Record<string, unknown> | undefined)?.[key];
      if (!Array.isArray(lines)) continue;
      for (const entry of lines) {
        assert.ok(
          typeof entry === "string" || Array.isArray(entry),
          `${name}.${key} has an entry GitLab cannot parse`,
        );
      }
    }
  }
});

test("the deploy job exists only with a kubeconfig, manually, on the default branch", () => {
  const rules = deployJob.rules;
  const active = rules.filter((rule) => rule.when !== "never");
  assert.equal(active.length, 1);
  assert.match(active[0]?.if ?? "", /\$KUBECONFIG/u);
  assert.match(active[0]?.if ?? "", /\$CI_DEFAULT_BRANCH/u);
  assert.equal(active[0]?.when, "manual");
  assert.equal(rules.at(-1)?.when, "never");
  assert.match(deployJob.script.join("\n"), /images\.tag=\$CI_COMMIT_SHA/u);
  assert.equal(deployJob.needs, undefined);
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
  assert.ok(config["deploy-production"]?.resource_group, "deploy group");
});

test("only production deploy jobs are not interruptible", () => {
  const config = parse(readFileSync(resolve(".gitlab-ci.yml"), "utf8"), {
    maxAliasCount: 50,
  }) as Record<string, Record<string, unknown>> & {
    readonly default: Record<string, unknown>;
  };
  const reserved = new Set(["workflow", "default", "stages", "variables"]);
  const uninterruptible = new Set(["deploy-production"]);
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

test("CI contains only deployment jobs", () => {
  const reserved = new Set(["workflow", "default", "stages", "variables"]);
  assert.deepEqual(
    Object.keys(jobs)
      .filter((name) => !reserved.has(name))
      .sort(),
    ["deploy-production"],
  );
});

test("deploy-production verifies all 4 images exist via JWT auth and complete Accept header before running helm", () => {
  const script = deployJob.script.join("\n");
  assert.match(script, /for img in api migrate web backup/u);
  assert.match(script, /\/jwt\/auth\?service=container_registry/u);
  assert.match(script, /Authorization: Bearer \$token/u);
  assert.match(script, /application\/vnd\.oci\.image\.index\.v1\+json/u);
  assert.match(
    script,
    /application\/vnd\.docker\.distribution\.manifest\.list\.v2\+json/u,
  );
  assert.match(script, /manifests\/\$CI_COMMIT_SHA/u);
  assert.match(
    script,
    /Please build and push all release images locally using 'pnpm images:build'/u,
  );
});
