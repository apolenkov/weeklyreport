# Tasks

- [x] 1.1 Remove the automatic `build-images` rule and keep it manual and non-blocking on default-branch/tag pipelines; refresh the job comment.
- [x] 1.2 Add the contract test for manual-only `build-images` rules; extract its shared fixtures into `ci-image-build.fixture.ts` to keep the test file under the staged-file size limit.
- [x] 1.3 Create the `ci-merge-gate` delta and align `docs/gitlab-ci.md`.
- [x] 1.4 Verify: focused vitest for the operations gate, scripts typecheck, `pnpm spec:check`, `pnpm exec prettier --check` on the changed files and `git diff --check`.
- [ ] 2.1 Publication: push to `main` and read CI on the exact SHA; outside this worktree's no-push scope.
