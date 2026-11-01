import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "vitest";
import { parse, parseAllDocuments } from "yaml";

import { podSpecOf, renderExample } from "./helm-chart-render.ts";

const read = (path: string): string => readFileSync(resolve(path), "utf8");

const REVIEWED_EXTERNAL_IMAGES = new Set([
  "alpine/helm:4.3.0@sha256:a6cf54599ccb99d90cf0712b30f03fdb3cab062e6b94e0418cc4db7e8a1464b2",
  "axllent/mailpit:v1.32.0@sha256:0790692be935ea4420d085694f7985b1f692ca6a8771ab0e0bd8ba75ac180498",
  "caddy:2.11.7-alpine@sha256:eb4d35b7452d1ab6171fbdbe8d9275b2301dad6dad92115d91e19fb9b24d510f",
  "edoburu/pgbouncer:v1.26.0-p0@sha256:b17551c776ef7e5769ef80b956d20f85e2fd25dd8912d31d58f782aad495b711",
  "gotenberg/gotenberg:8.39.0-chromium@sha256:558943677cf9092df83ff654c2645856dcb9ddf777f359243789688e74f3bcdd",
  "node:26.13.0-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94",
  "node:26.13.0-trixie@sha256:6d2c7d5d074bf72f81ddc252b4fbb5d625bc028eeda49cb4b8c2ff8eda1ee617",
  "pgvector/pgvector:0.8.7-pg15-bookworm@sha256:47af0b65960b14f1c6945aa4ccae37836c632e9a6fe0eea9160936e616e5b2e9",
  "postgres:16.15-alpine@sha256:0cefaabd882e42bcb2a2f3dc56d3ce4770560ba62fd7f197f1a2e008fd5731ab",
  "redis:8.10.3-alpine@sha256:896f241f438ab6a210cfb24f573b84bea721a4cbe67f1b4fd07eb638b3b02a7b",
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
    `redis:8.10.3-alpine@sha256:${digest}`,
  ]) {
    assert.throws(() => assertReviewedExternalImage("probe", image));
  }
});

test("GitLab CI does not build container images", () => {
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
    assert.notEqual(
      name,
      "build-images",
      `.gitlab-ci.yml must not contain build-images job (images built locally on Mac)`,
    );
    const builds = JSON.stringify(jobs[name]?.script ?? []).includes(
      "buildah bud",
    );
    assert.equal(
      builds,
      false,
      `.gitlab-ci.yml:${name}: CI must not run buildah`,
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
  assert.doesNotMatch(read(".gitlab-ci.yml"), /buildkit|buildctl|rootless/iu);
});
