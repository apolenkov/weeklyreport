import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "vitest";
import { parse, parseAllDocuments } from "yaml";

import { podSpecOf, renderExample } from "./helm-chart-render.ts";

const read = (path: string): string => readFileSync(resolve(path), "utf8");

const REVIEWED_EXTERNAL_IMAGES = new Set([
  "alpine/helm:4.3.0@sha256:a6cf54599ccb99d90cf0712b30f03fdb3cab062e6b94e0418cc4db7e8a1464b2",
  "axllent/mailpit:v1.31.5@sha256:94f6b70c1436defae6799d9ac7ff0eeff9540465b842026d5cdb018f1c0234ea",
  "caddy:2.11.7-alpine@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f",
  "edoburu/pgbouncer:v1.26.0-p0@sha256:b17551c776ef7e5769ef80b956d20f85e2fd25dd8912d31d58f782aad495b711",
  "gotenberg/gotenberg:8.37.0-chromium@sha256:0d28ae9a96441588ef739623726bd500ad0720b77266c6f1351a13e333fbd61c",
  "moby/buildkit:v0.34.0-rootless@sha256:65eca3c01cd1180c8f64565c4e3c5983af5145818b0e6fa863385d099eb73855",
  "node:26.11.1-alpine@sha256:143494b1da2945f061539253adc65e4f1569ddf07da2d384c022c791a9d90a4a",
  "node:26.11.1-trixie@sha256:32fa97f3363975684b08bf4e8a68a47c7905175cc20275b50b974bbd02aba731",
  "pgvector/pgvector:0.8.7-pg15-bookworm@sha256:47af0b65960b14f1c6945aa4ccae37836c632e9a6fe0eea9160936e616e5b2e9",
  "postgres:16.15-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea",
  "redis:8.10.2-alpine@sha256:3811787313eba226a2ef38658c6ccb91cd5e110edc89c37767de373120a0e5a0",
]);

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

interface ImageReference {
  readonly path: string;
  readonly image: string;
}

function localDependencyImages(): ImageReference[] {
  const path = "deploy/local-dev/deps.yaml";
  return parseAllDocuments(read(path)).flatMap((document) => {
    const manifest = document.toJS() as {
      readonly kind: string;
      readonly metadata: { readonly name: string };
      readonly spec: {
        readonly template?: {
          readonly spec: {
            readonly containers: readonly { readonly image: string }[];
          };
        };
      };
    };
    return (manifest.spec.template?.spec.containers ?? []).map(({ image }) => ({
      path: `${path}:${manifest.metadata.name}`,
      image,
    }));
  });
}

function ciImages(): ImageReference[] {
  const model = parse(read(".gitlab-ci.yml"), { maxAliasCount: 50 }) as Record<
    string,
    {
      readonly image?: string | { readonly name?: string };
      readonly services?: readonly { readonly name?: string }[];
    }
  >;
  return Object.entries(model).flatMap(([job, definition]) => {
    const image =
      typeof definition.image === "string"
        ? definition.image
        : definition.image?.name;
    return [
      ...(image === undefined
        ? []
        : [{ path: `.gitlab-ci.yml:${job}`, image }]),
      ...(definition.services ?? []).flatMap((service) =>
        service.name === undefined
          ? []
          : [{ path: `.gitlab-ci.yml:${job}:services`, image: service.name }],
      ),
    ];
  });
}

function chartImages(): ImageReference[] {
  const { manifests } = renderExample([
    "--set",
    "images.registry=registry.example.com/reviewed",
  ]);
  return manifests
    .filter((manifest) =>
      ["Deployment", "StatefulSet", "CronJob"].includes(manifest.kind),
    )
    .flatMap((manifest) => {
      const pod = podSpecOf(manifest);
      return [...(pod.initContainers ?? []), ...pod.containers]
        .filter(
          (container) =>
            !container.image.startsWith("registry.example.com/reviewed/"),
        )
        .map((container) => ({
          path: `${manifest.kind}/${manifest.metadata.name}/${container.name}`,
          image: container.image,
        }));
    });
}

function dockerfileImages(): ImageReference[] {
  return [
    "Dockerfile.api",
    "Dockerfile.web",
    "deploy/postgres/Dockerfile.backup",
  ].flatMap((path) =>
    [...read(path).matchAll(/^FROM (\S+)/gmu)]
      .map((match) => match[1] ?? "")
      .filter((image) => image.includes(":"))
      .map((image) => ({ path, image })),
  );
}

test("chart, CI, build and local dependency external images use reviewed immutable releases", () => {
  const images = [
    ...chartImages(),
    ...ciImages(),
    ...localDependencyImages(),
    ...dockerfileImages(),
  ];
  assert.ok(images.length > 0);
  for (const { path, image } of images)
    assertReviewedExternalImage(path, image);
  assert.deepEqual(
    new Set(images.map(({ image }) => image)),
    REVIEWED_EXTERNAL_IMAGES,
  );
});

test("external image policy rejects moving and mismatched references", () => {
  const digest = "a".repeat(64);
  for (const image of [
    `redis:latest@sha256:${digest}`,
    `redis:stable@sha256:${digest}`,
    `redis:7-alpine@sha256:${digest}`,
    `redis:${"$" + "{TAG}"}@sha256:${digest}`,
    `redis:8.10.2-alpine@sha256:${digest}`,
  ]) {
    assert.throws(() => assertReviewedExternalImage("probe", image));
  }
});

test("GitLab CI builds images only in the gated build-images job", () => {
  const jobs = parse(read(".gitlab-ci.yml"), { maxAliasCount: 50 }) as Record<
    string,
    { readonly script?: readonly unknown[] } | undefined
  >;
  for (const name of Object.keys(jobs)) {
    assert.doesNotMatch(
      name,
      /docker/iu,
      `.gitlab-ci.yml:${name} must not be a Docker lane`,
    );
    const builds = JSON.stringify(jobs[name]?.script ?? []).includes(
      "buildctl-daemonless.sh",
    );
    assert.equal(
      builds,
      name === "build-images",
      `.gitlab-ci.yml:${name}: only build-images may run BuildKit`,
    );
  }
  assert.doesNotMatch(read(".gitlab-ci.yml"), /docker build/u);
  assert.doesNotMatch(read(".gitlab-ci.yml"), /docker compose/u);
  assert.doesNotMatch(
    read(".gitlab-ci.yml"),
    /docker-compose (up|run|exec|build)/u,
  );
  assert.doesNotMatch(read(".gitlab-ci.yml"), /docker:dind|\bdind\b/iu);
  assert.doesNotMatch(read(".gitlab-ci.yml"), /docker\.sock/u);
});
