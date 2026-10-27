# Proposal

## Why

The owner decided on 2026-10-27 ~17:00 that every repository should carry the
minimal CI while the GitLab runners are unreliable: heavy jobs must not load the
runners by themselves. In this repository the only heavy job, `build-images`,
started automatically on default-branch pipelines whenever
`WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING` was set, unlike the manual, non-blocking
path used before the web build values were configured. TASK-727 keeps the job
and its outputs but makes every pipeline start it by hand.

## What Changes

- `build-images` drops the `when: on_success` rule keyed on
  `WR_NEXT_PUBLIC_CLIENT_LOG_FORWARDING`; the default-branch/tag rule
  (`when: manual`, `allow_failure: true`) is the only one left for it there.
- The schedule (`when: never`) and merge-request (`when: manual`,
  `allow_failure: true`) rules stay; the build script, `deploy-production` and
  `workflow` are untouched.
- The CI contract test asserts that no `build-images` rule is automatic and that
  the default-branch/tag rule stays manual and non-blocking.
- The job comment and `docs/gitlab-ci.md` stop promising an automatic
  default-branch run.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ci-merge-gate`: the image-build job is manual and non-blocking on
  default-branch, tag and merge-request pipelines instead of automatic once the
  web build variables are configured.

## Impact

`.gitlab-ci.yml`, `scripts/gates/operations/ci-image-build.test.ts` (shared
fixtures move to `ci-image-build.fixture.ts` so the test file stays under the
staged-file size limit), `docs/gitlab-ci.md` and the `ci-merge-gate`
requirement. No application behaviour, image content, deployment, workflow or
runner change.

## Non-goals

- No removal of `build-images` or `deploy-production`; the four images, build
  args, digest artifact and fail-closed checks stay.
- No runner, memory-limit or `WR_NEXT_PUBLIC_*` value work: the job still fails
  closed at run time when an input is missing.

## Archive coordination

`light-build-only-ci` and `build-images-buildah` still carry unarchived
`ci-merge-gate` deltas for this same requirement. Their owners must reconcile
those deltas with this text before archiving, or an archive could restore the
automatic-run wording.
