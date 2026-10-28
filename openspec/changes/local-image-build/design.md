# Design: Local Image Build and CI Verification

## Overview

Image builds are transferred from unstable GitLab runners to the local workstation (Mac with OrbStack Docker buildx). The `build-images` job is removed from `.gitlab-ci.yml`. A new TypeScript CLI script (`scripts/build-images.ts`), exposed via `pnpm images:build`, handles building and pushing the 4 container images (`api`, `migrate`, `web`, `backup`). The `deploy-production` job in GitLab CI verifies that the 4 images exist in the registry before proceeding with Helm operations.

## Architecture & Workflows

### 1. `scripts/build-images.ts` and `pnpm images:build`

- Environment & Preconditions:
  - Validates git working tree is clean (`git status --porcelain` is empty).
  - Validates HEAD commit is on / contained within `gitlab/main` (`git merge-base --is-ancestor HEAD gitlab/main` or current commit in `git rev-parse gitlab/main`).
  - Validates required build arguments for web:
    - `WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING`
    - `WR_NEXT_PUBLIC_WEB_VITALS`
    - `WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED`
    - `WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES`
  - Tag resolution: `git rev-parse HEAD`.
  - Release coordinates: `deploy/images/release.env` (`IMAGE_REGISTRY=registry.example.com:5005/example/weeklyreport`, `IMAGE_PLATFORM=linux/amd64`) is the single source, read before any git or Docker call. No env var, CLI option or literal fallback overrides it; a missing file or empty value refuses. The same file feeds `deploy-production` (manifest checks and `--set images.registry`). The platform is a decision, not a documented cluster fact: the cluster architecture is not recorded in the repository, so the owner must confirm `linux/amd64` before release.
  - Platform: `docker buildx build --platform $IMAGE_PLATFORM --push`. After each push, `docker buildx imagetools inspect --raw <tag>` must return an OCI/Docker index that lists the platform (buildx adds an attestation entry with `unknown/unknown`, which is ignored).
  - Fail closed on missing Docker / buildx, unauthenticated registry (unless `--no-push`).
- Docker buildx commands:
  - `api`: `Dockerfile.api`, context `.`, build-arg `BUILD_VERSION=$SHA`.
  - `migrate`: `Dockerfile.api`, target `migrator`, context `.`, build-arg `BUILD_VERSION=$SHA`.
  - `web`: `Dockerfile.web`, context `.`, build-args matching former CI:
    - `API_URL=http://api:3001`
    - `NEXT_PUBLIC_AUTH_STUB=false`
    - `NEXT_PUBLIC_DEV_ROLE_SWITCHER=false`
    - `NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN:-}`
    - `NEXT_PUBLIC_APP_VERSION=$SHA`
    - `NEXT_PUBLIC_CLIENT_LOG_FORWARDING=$WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING`
    - `NEXT_PUBLIC_WEB_VITALS=$WR_NEXT_PUBLIC_WEB_VITALS`
    - `NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED=$WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_ENABLED`
    - `NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES=$WR_NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES`
  - `backup`: `deploy/postgres/Dockerfile.backup`, context `deploy/postgres`, build-arg `BUILD_VERSION=$SHA`.
  - Flag `--push` vs `--load`/`--no-push`.
  - Filter option `--only <target>` (e.g. `--only api,backup` or targets) or flags to allow selective builds for memory constrained environments.

### 2. Lefthook Hook (`lefthook.yml`)

- In `pre-push`:
  - Keep existing `check` job.
  - Add optional `images:build` job that triggers ONLY when `WR_IMAGES_ON_PUSH=1` or runs conditionally within the pre-push hook:
    `if [ "${WR_IMAGES_ON_PUSH:-0}" = "1" ]; then pnpm images:build; fi`

### 3. `.gitlab-ci.yml` and `deploy-production`

- Delete `build-images` job.
- Remove `needs: [job: build-images]` from `deploy-production`.
- Keep `pages` stage/job if present or needed.
- In `deploy-production` script:
  - First step verifies presence of the 4 images in the target registry with tag `$CI_COMMIT_SHA`.
  - In `alpine/helm` image (or whatever image deploy-production runs), verify images using available tools (e.g. `crane` or curl to registry v2 API using `$CI_JOB_TOKEN` or registry credentials).
  - If any image manifest is missing (404/failure), abort immediately with exit 1 and a descriptive error message: "Required image $REGISTRY/$NAME:$CI_COMMIT_SHA is missing from registry. Build and push locally with 'pnpm images:build' before deploying."
  - The registry comes from `deploy/images/release.env` (same file as section 1). Helm receives `--set images.registry=<same value>`, so the checked and installed image paths are identical by construction.
  - Registry credentials come from `IMAGE_REGISTRY_USER`/`CI_REGISTRY_USER` and `IMAGE_REGISTRY_PASSWORD`/`CI_REGISTRY_PASSWORD`/`CI_JOB_TOKEN`; the job refuses when either is empty. `CI_SERVER_URL` is required. The literal `gitlab-ci-token` fallback is removed.
  - The platform is not checked at deploy time (parsing an index without `jq` in the Helm image is not cheap); it is checked at build time after each push.

### 4. Gates and Documentation

- Update `scripts/gates/operations/ci-image-build.test.ts`, `deploy-production.test.ts`, `deployment-images.test.ts`.
- Update `docs/gitlab-ci.md` and `docs/artifacts.md`.
