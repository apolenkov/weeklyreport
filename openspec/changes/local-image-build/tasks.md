# Tasks: local-image-build

- [x] 1. Implement local image build script and CLI entrypoint
  - [x] 1.1 Create `scripts/build-images.ts` with checks for git cleanliness, gitlab/main ancestor, required WR_NEXT_PUBLIC_* vars, registry login, and `--no-push` option.
  - [x] 1.2 Add `"images:build": "tsx scripts/build-images.ts"` to root `package.json`.
- [x] 2. Update pre-push hook configuration
  - [x] 2.1 Update `lefthook.yml` to support building images on push only when `WR_IMAGES_ON_PUSH=1`.
- [x] 3. Update GitLab CI pipeline and deploy-production verification
  - [x] 3.1 Remove `build-images` job from `.gitlab-ci.yml`.
  - [x] 3.2 Update `deploy-production` to check that the 4 images exist with tag `$CI_COMMIT_SHA` in the registry before running Helm commands.
  - [x] 3.3 Update gates in `scripts/gates/operations/*` and colocated tests.
- [x] 4. Documentation updates
  - [x] 4.1 Update `docs/gitlab-ci.md` and `docs/artifacts.md`.
- [x] 5. Verification and delivery
  - [x] 5.1 Test `pnpm images:build --no-push` locally for targets.
  - [x] 5.2 Run verification gates (format, lint, typecheck, test, build, spec:check).
