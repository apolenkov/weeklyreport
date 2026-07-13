## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`.github/workflows/ci.yml` triggers on `workflow_dispatch` only and has never
run automatically; the repo has 0 GitHub Actions runners assigned, and
branch protection / rulesets return 403 on this private free-tier repo. This
dispatch-only posture is a documented, accepted decision for the current MVP
phase (no production point exists yet — see `CLAUDE.md`'s MVP Phase section)
and this change does not relitigate it.

What the review found missing is the plan for the transition _out_ of that
posture. The only currently-active gate is `.husky/pre-push`, which runs
typecheck, lint, format:check, catalog drift, and unit tests — a strict
subset of what `ci.yml` defines (it omits integration tests, the Playwright
e2e suite, the `migrate reset` drift job, the Docker build job, `uat:audit`,
and visual regression, all of which exist only in the dormant workflow). The
hook also no-ops whenever the ambient `CI` environment variable happens to
be `"true"`, which is not a hook-specific opt-out and could silently disable
the gate in any environment that sets `CI=true` for unrelated reasons. There
is currently no written requirement that says: before the first production
point, a runner must be provisioned, required status checks must be turned
on, and the interim local gate must cover the gates that are cheap enough to
run without services.

## What Changes

- Add an `openspec/specs/ci-merge-gate/spec.md` capability spec that records
  the pre-production-point requirement: a CI runner must be provisioned and
  `ci.yml`'s `on:` trigger must include `pull_request` and `push: [main]`
  with required status checks enabled, before the repo's first production
  point. Until then, the interim local gate (`.husky/pre-push`) is the
  documented active gate and must fold in the deterministic, no-external-
  service-dependency checks that `ci.yml` currently runs but `pre-push`
  currently skips.
- `.husky/pre-push`: add `pnpm uat:audit` (the mutation-consumer audit — pure
  Node, no DB) to the existing chain, after `pnpm catalog:check` and before
  `pnpm test`.
- `.husky/pre-push`: replace the ambient `CI=true` bypass condition with a
  hook-specific opt-out. The skip check becomes `[ "$SKIP_PREPUSH" = "1" ]`
  only; a comment records that `ci.yml`'s own jobs do not invoke this hook
  (`husky` is not installed in the CI install step), so the `CI` branch was
  dead weight that additionally created a silent bypass footgun for any
  future environment that sets `CI=true` outside GitHub Actions.
- `.github/workflows/ci.yml`: add a comment above the `on:` block recording
  the pre-production-point requirement (runner provisioning + required
  checks) so the trigger's dispatch-only state reads as a tracked, dated
  TODO rather than a permanent design choice.
- Non-goals: no runner is provisioned by this change (infra action, not
  code); `migrate reset` drift, the Docker build job, and visual regression
  stay CI-only — they need services/build artifacts pre-push does not have
  and are correctly deferred to the future server-side gate, not folded in
  here.
