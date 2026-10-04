import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "vitest";
import { parse } from "yaml";

import { podSpecOf, renderExample } from "./helm-chart-render.ts";

const read = (path: string): string => readFileSync(resolve(path), "utf8");

const REVIEWED_EXTERNAL_IMAGES = new Set([
  "alpine/helm:4.3.0@sha256:a6cf54599ccb99d90cf0712b30f03fdb3cab062e6b94e0418cc4db7e8a1464b2",
  "axllent/mailpit:v1.31.0@sha256:c96991d9bef73594c246d89ca81411d4e916f03e76a7d2d72fa2ab5dd3c9ce24",
  "axllent/mailpit:v1.31.3@sha256:ed9b00c609e77e99c79b93f1178255ebc271868920f2c69a8d166bd5634ed10d",
  "bugsink/bugsink:2.6.1@sha256:c5e3657451f4ba1ddb145a5118a4347314206cc5ba98f40e5f268c6c0975963e",
  "caddy:2.11.4-alpine@sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b",
  "edoburu/pgbouncer:v1.26.0-p0@sha256:b17551c776ef7e5769ef80b956d20f85e2fd25dd8912d31d58f782aad495b711",
  "gotenberg/gotenberg:8.37.0-chromium@sha256:0d28ae9a96441588ef739623726bd500ad0720b77266c6f1351a13e333fbd61c",
  "grafana/otel-lgtm:0.34.0@sha256:b966ea107831d526d9eb8fe4d2d86c9e5731392fad9dce8296bcf2072031f07c",
  "moby/buildkit:v0.33.1-rootless@sha256:f8a833b2de9d68e27f0815e4a737abdfaf8a2e4c615650557df11025101557b4",
  "node:26.10.0-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80",
  "node:26.10.0-bookworm@sha256:2aaae6d91f99fee84cfc92da9b52c22a185752d247746052bbc3f961e44478c6",
  "oliver006/redis_exporter:v1.93.0@sha256:6ca518a72f30f7f576ef92963de1b91d3c3f5fd3aeac949f878bfda183587820",
  "pgvector/pgvector:0.8.7-pg15-bookworm@sha256:47af0b65960b14f1c6945aa4ccae37836c632e9a6fe0eea9160936e616e5b2e9",
  "postgres:15.19-alpine@sha256:f7d23353e1b15400d22ebe31189f4d314b87a4c129cc400c8c2d8d4ca127bf81",
  "prometheuscommunity/postgres-exporter:v0.20.1@sha256:ac5ec343104fae0e2d84a27bb8d69b38430a11910c5382cad85d478d2bab713e",
  "redis:7.4.11-alpine@sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499",
  "redis:7.4.11-alpine@sha256:ff02b58f971e7d7d156a1267e283fcbbeee91773b6aa36c49dac28ecfe28eadf",
  "renovate/renovate:41.173.1@sha256:e998e1218fe572e23278d8808186a310784f7cb2ac8055307183ffc51d3a59e5",
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

function localComposeImages(): ImageReference[] {
  return [
    "docker-compose.yml",
    "docker-compose.dev.yml",
    "docker-compose.observability.yml",
    "docker-compose.observability.dev.yml",
    "docker-compose.errors.yml",
  ].flatMap((path) => {
    const model = parse(read(path), { maxAliasCount: 50 }) as {
      readonly services?: Readonly<
        Record<string, { readonly build?: unknown; readonly image?: unknown }>
      >;
    };
    return Object.entries(model.services ?? {}).flatMap(
      ([service, definition]) => {
        if (definition.image === undefined) return [];
        assert.ok(typeof definition.image === "string", `${path}:${service}`);
        assert.equal(
          definition.build,
          undefined,
          `${path}:${service}: local builds must not masquerade as reviewed external images`,
        );
        return [{ path: `${path}:${service}`, image: definition.image }];
      },
    );
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

test("chart, CI, build and local Compose external images use reviewed immutable releases", () => {
  const images = [
    ...chartImages(),
    ...ciImages(),
    ...localComposeImages(),
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
    `redis:7.4.11-alpine@sha256:${digest}`,
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
