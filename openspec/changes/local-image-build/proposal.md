# Proposal

## Why

On 2026-10-28 14:10 MSK (TASK-709), the owner decided: "сборку переносить, по максимуму всё на Mac; пусть нагружается при push — будем реже пушиться; если в GitLab сборки постоянно падают — какой смысл". GitLab runner memory limits and rootless build issues prevent reliable CI image building. Image builds move to the developer/operator workstation (Mac with OrbStack Docker buildx).

This replaces and supersedes the unfinished change `build-images-buildah` (which attempted to migrate the in-CI build job to buildah on the runner); that approach is discontinued and its change artifacts are removed and archived.

## What Changes

- Supersedes and removes `openspec/changes/build-images-buildah`.
- Remove the `build-images` job from `.gitlab-ci.yml`.
- Keep `pages` job in `.gitlab-ci.yml` if present (or preserve CI contract), and keep `deploy-production`.
- `deploy-production` no longer depends on `build-images` via `needs: [job: build-images]`. Instead, `deploy-production` checks upfront that all 4 required images (`api`, `migrate`, `web`, `backup`) tagged with `$CI_COMMIT_SHA` exist in the registry (using registry manifest check via curl) and fails closed with a clear message if any are missing.
- Add TypeScript script `scripts/build-images.ts` (invoked via `pnpm images:build` in root `package.json`) using `docker buildx` on Mac (OrbStack) to build `api`, `migrate`, `web`, `backup` with the exact same Dockerfiles, targets, and build args as the previous CI build, tagged with the full commit SHA of HEAD, pushing to the Helm image registry.
- Fail closed in `images:build`: dirty git tree, HEAD not on `gitlab/main`, missing required `WR_NEXT_PUBLIC_*` environment variables, or registry unauthenticated/unreachable. Provide `--no-push` flag for local verification without publishing.
- Update `lefthook.yml` pre-push hook: run `images:build` ONLY when explicitly requested via environment variable (`WR_IMAGES_ON_PUSH=1`). Do not skip existing check gates.
- Update contract tests in `scripts/gates/*` and documentation (`docs/gitlab-ci.md`, `docs/artifacts.md`).

## Capabilities

### Modified Capabilities

- `ci-merge-gate`: CI runs only deployment (and pages if defined); image building happens locally on Mac via `pnpm images:build` and pushes SHA-tagged images to the registry before deployment. Deployment verifies image presence in registry before mutating the cluster.

## Impact

- `.gitlab-ci.yml`
- `package.json`
- `scripts/build-images.ts`
- `lefthook.yml`
- `scripts/gates/operations/*`
- `docs/gitlab-ci.md`, `docs/artifacts.md`
- `openspec/specs/ci-merge-gate/spec.md`
- `openspec/changes/build-images-buildah` (removed/superseded)

## Non-goals

- No remote runner image builds; CI image building is eliminated.
- No push to remote registry during local agent runs (requires owner authentication).
- No bypass of existing checks or pre-push gates.
