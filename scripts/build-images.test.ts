import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, test } from "vitest";

import { parseCliArgs } from "./build-images.ts";
import {
  assertPlatformInIndex,
  buildxArgs,
  getImageTargets,
  parseEnvFile,
  readReleaseConfig,
} from "./build-images-plan.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const WEB_ENV = {
  WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING: "false",
  WR_NEXT_PUBLIC_WEB_VITALS: "false",
  WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED: "false",
  WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES: "admin",
};

// Captured from `docker buildx imagetools inspect --raw` after a
// `buildx build --platform linux/amd64 --push` on a local registry:2.
const PUSHED_INDEX = JSON.stringify({
  schemaVersion: 2,
  mediaType: "application/vnd.oci.image.index.v1+json",
  manifests: [
    {
      mediaType: "application/vnd.oci.image.manifest.v1+json",
      digest:
        "sha256:e4942749eb81f835b3c6f028297c42ef2686d8a32516228ba7ab9543cc681954",
      size: 476,
      platform: { architecture: "amd64", os: "linux" },
    },
    {
      mediaType: "application/vnd.oci.image.manifest.v1+json",
      digest:
        "sha256:4de7d87c8acf9b593b9128bc8c0e0987e8b3fc850d441dd14a1ef85134cadd4a",
      size: 835,
      annotations: {
        "vnd.docker.reference.type": "attestation-manifest",
      },
      platform: { architecture: "unknown", os: "unknown" },
    },
  ],
});

const workspaces = new Set<string>();
afterEach(() => {
  for (const root of workspaces) rmSync(root, { recursive: true, force: true });
  workspaces.clear();
});

test("the CLI defaults to a pushing build of every target", () => {
  assert.deepEqual(parseCliArgs([]), { push: true, targets: undefined });
});

test("the CLI selects targets and disables the push", () => {
  assert.deepEqual(parseCliArgs(["--no-push", "--only", "api, backup"]), {
    push: false,
    targets: ["api", "backup"],
  });
  assert.deepEqual(parseCliArgs(["--target", "web"]), {
    push: true,
    targets: ["web"],
  });
});

test("the CLI has no registry override, so the committed file stays the only source", () => {
  assert.throws(() => parseCliArgs(["--registry", "example.test/x"]), {
    message: "Unknown option: --registry",
  });
});

test("the CLI rejects an option without its value and unknown options", () => {
  assert.throws(() => parseCliArgs(["--only"]), /Missing value for --only/u);
  assert.throws(() => parseCliArgs(["--bogus"]), /Unknown option/u);
});

test("the committed release file names the registry and the amd64 platform", () => {
  const release = readReleaseConfig(
    readFileSync(resolve("deploy/images/release.env"), "utf8"),
  );
  assert.deepEqual(release, {
    registry: "registry.example.com:5005/example/weeklyreport",
    platform: "linux/amd64",
  });
});

test("a release file without a registry or platform is refused, naming the key", () => {
  const valid = "IMAGE_REGISTRY=example.test/x\nIMAGE_PLATFORM=linux/amd64\n";
  assert.throws(
    () => readReleaseConfig(valid.replace(/IMAGE_REGISTRY=.*\n/u, "")),
    /Missing IMAGE_REGISTRY in deploy\/images\/release\.env/u,
  );
  assert.throws(
    () => readReleaseConfig(valid.replace("linux/amd64", "")),
    /Missing IMAGE_PLATFORM/u,
  );
  assert.throws(() => readReleaseConfig(""), /Missing IMAGE_REGISTRY/u);
});

test("a malformed platform is refused before it reaches buildx", () => {
  assert.throws(
    () =>
      readReleaseConfig(
        "IMAGE_REGISTRY=example.test/x\nIMAGE_PLATFORM=amd64\n",
      ),
    /IMAGE_PLATFORM must look like os\/architecture/u,
  );
});

test("env files ignore comments and blank lines and keep values after the first equals sign", () => {
  assert.deepEqual(parseEnvFile("# note\n\nKEY=a=b \n  OTHER = c\n"), {
    KEY: "a=b",
    OTHER: "c",
  });
});

test("every image is built for the release platform with its Dockerfile and build args", () => {
  const targets = getImageTargets(SHA, WEB_ENV);
  assert.deepEqual(
    targets.map((target) => target.name),
    ["api", "migrate", "web", "backup"],
  );
  for (const target of targets) {
    const args = buildxArgs(
      target,
      `example.test/x/${target.name}:${SHA}`,
      "linux/amd64",
      true,
    );
    assert.equal(
      args[args.indexOf("--platform") + 1],
      "linux/amd64",
      target.name,
    );
    assert.equal(args.at(-2), "--push", target.name);
    assert.equal(args.at(-1), target.context, target.name);
    assert.ok(args.includes(`example.test/x/${target.name}:${SHA}`));
  }
});

test("the migrator target and web build args match the former CI job", () => {
  const targets = getImageTargets(SHA, WEB_ENV);
  const migrateTarget = targets.find((target) => target.name === "migrate");
  assert.ok(migrateTarget);
  const migrate = buildxArgs(
    migrateTarget,
    "example.test/x/migrate:tag",
    "linux/amd64",
    false,
  );
  assert.deepEqual(
    migrate.slice(migrate.indexOf("--target"), migrate.indexOf("--target") + 2),
    ["--target", "migrator"],
  );
  assert.equal(migrate.at(-2), "--load");

  const web = targets.find((target) => target.name === "web");
  assert.ok(web?.buildArgs.includes("NEXT_PUBLIC_WEB_VITALS=false"));
  assert.ok(web?.buildArgs.includes(`NEXT_PUBLIC_APP_VERSION=${SHA}`));
});

test("the pushed registry index must list the release platform", () => {
  assert.doesNotThrow(() =>
    assertPlatformInIndex(
      PUSHED_INDEX,
      "example.test/x/api:tag",
      "linux/amd64",
    ),
  );
});

test("an index without the release platform fails and names image and platform", () => {
  const arm64Only = JSON.stringify({
    manifests: [{ platform: { architecture: "arm64", os: "linux" } }],
  });
  assert.throws(
    () =>
      assertPlatformInIndex(arm64Only, "example.test/x/api:tag", "linux/amd64"),
    /example\.test\/x\/api:tag does not list platform linux\/amd64/u,
  );
});

test("a single manifest without an index cannot prove the platform", () => {
  const single = JSON.stringify({ schemaVersion: 2, config: {} });
  assert.throws(() =>
    assertPlatformInIndex(single, "example.test/x/api:tag", "linux/amd64"),
  );
});

test("a registry answer that is not JSON fails closed", () => {
  assert.throws(() =>
    assertPlatformInIndex("not json", "example.test/x/api:tag", "linux/amd64"),
  );
});

test("the CLI refuses before any git or Docker call when the release file is missing", () => {
  const directory = mkdtempSync(join(tmpdir(), "build-images-"));
  workspaces.add(directory);
  const result = spawnSync(
    resolve(import.meta.dirname, "..", "node_modules", ".bin", "tsx"),
    [resolve(import.meta.dirname, "build-images.ts"), "--no-push"],
    { cwd: directory, encoding: "utf8" },
  );
  assert.equal(result.status, 1, result.stderr);
  assert.match(
    result.stderr,
    /Missing release config: deploy\/images\/release\.env/u,
  );
  assert.doesNotMatch(result.stderr, /git /u);
});
