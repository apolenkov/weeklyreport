# Tasks

- [x] 1.1 Spec delta for `ci-merge-gate`.
- [x] 1.2 Rewrite `build-images` on buildah: pinned mirror image, vfs/chroot, `--format docker`, `--digestfile`, same tags, build args, rules and fail-closed checks.
- [x] 1.3 Mirror every external base image in a job-local Dockerfile copy; fail before building when one escapes the mirror.
- [x] 1.4 `Dockerfile.web`: `nextjs` joins the `nodejs` group, `COPY --chown=nextjs:nodejs`, uid 1001 kept.
- [x] 1.5 Align the CI contract tests and the reviewed external-image set with buildah.
- [x] 1.6 Update `docs/gitlab-ci.md` and `docs/kubernetes.md`.
- [x] 1.7 Verify: focused vitest for the operations gates, `pnpm format:check`, `pnpm spec:check`, `git diff --check`; no image build, push or pipeline run.
- [ ] 2.1 Full `build-images` run on `uds-gl-runner01` after DevOps raises the 4 GiB job memory limit and the owner supplies the production `WR_NEXT_PUBLIC_*` values.
- [ ] 2.2 Publication: push to `main` and verify the pipeline on the exact SHA; outside this task's no-push scope.
