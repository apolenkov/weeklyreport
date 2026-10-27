# Proposal

## Why

The image-build runner `uds-gl-runner01` (tag `img-build`, GitLab Runner 15.10.1
Docker executor) starts job containers inside a user namespace whose uid map
cannot allocate the `/etc/subuid` range that rootless BuildKit needs, so
`buildkitd` never starts there (`newuidmap: write to uid_map failed: Operation
not permitted`; probe job 3273126). The owner decided on 2026-10-27 (TASK-709)
not to change the runner profile: `build-images` moves to the platform's
supported buildah path, which the probe exercised on that runner (job 3273130;
full api/migrate builds in pipeline 299551, with web failing only at a
Dockerfile chown group).

## What Changes

- `build-images` runs buildah from the pinned internal-mirror image with
  `STORAGE_DRIVER=vfs` and `BUILDAH_ISOLATION=chroot`, keeps the four
  SHA-tagged `api`/`migrate`/`web`/`backup` images, the build args and the
  `image-digests.txt` artifact, and adds `--format docker` so the Docker v2
  manifest keeps `HEALTHCHECK`.
- Every external base image is pulled from the internal Docker Hub mirror: the
  job rewrites the `FROM` references into a job-local Dockerfile copy and fails
  before building if a base image escapes the mirror. The repository Dockerfiles
  keep their upstream pinned `tag@sha256` references.
- `Dockerfile.web` puts the `nextjs` user into the dedicated `nodejs` group and
  copies the standalone tree to `nextjs:nodejs`. buildah only resolves an
  existing group, whereas BuildKit silently kept the user's passwd gid
  (`nogroup`, 65533). The uid stays 1001, so the Next process keeps the same
  owner and no broader write access.
- CI contract tests, `docs/gitlab-ci.md`, `docs/kubernetes.md` and the
  `ci-merge-gate` requirement describe the buildah path.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ci-merge-gate`: the image-build job fails closed on buildah with no Docker
  daemon and satisfies the same registry, tag, digest and rules contract.

## Impact

`.gitlab-ci.yml`, `Dockerfile.web`, the operations contract tests, the two CI
docs and `openspec/specs/ci-merge-gate/spec.md`. No application behavior,
deployment chart, pipeline trigger or web runtime change.

## Non-goals

- No runner change (userns, subuid, seccomp profiles) and no rootless-BuildKit
  fallback; that path is dropped.
- No Dockerfile redesign: only the web runner ownership line changes; base
  images, build args and the `RUN --mount=type=cache` installer stages stay.
- No memory workaround (build split, swap tricks, cache surgery). The runner's
  4 GiB job limit and its increase with DevOps stay the blocker for the web
  image.
- No image build, push or deployment from this change; publication stays manual.

## Archive coordination

`light-build-only-ci` still carries an unarchived `ci-merge-gate` delta with the
previous BuildKit wording for the same requirement. Its owner must reconcile that
delta with this text before archiving it, or the archive would restore the
BuildKit requirement.
