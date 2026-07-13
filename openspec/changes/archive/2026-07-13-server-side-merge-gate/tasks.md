## 1. Pre-push gate: fold in cheap deterministic checks

- [ ] 1.1 `.husky/pre-push`: add `pnpm uat:audit` to the chain, run after
      `pnpm catalog:check` and before `pnpm test`
- [ ] 1.2 `.husky/pre-push`: change the skip condition from
      `[ "$CI" = "true" ] || [ "$SKIP_PREPUSH" = "1" ]` to
      `[ "$SKIP_PREPUSH" = "1" ]`; update the header comment to explain that
      `ci.yml` never invokes this hook (husky is not installed in the CI
      install step) so the `CI` branch was a redundant, silently-triggerable
      bypass
- [ ] 1.3 Confirm `pnpm uat:audit` runs standalone with no DB/service
      dependency (reads `apps/web/uat-suite/mutation-audit.allowlist.json`
      and static source only)

## 2. CI workflow: record the pre-production-point requirement

- [ ] 2.1 `.github/workflows/ci.yml`: add a dated comment above the `on:`
      block stating that before the first production point, a runner must
      be provisioned and the trigger must expand to
      `on: { pull_request, push: { branches: [main] } }` with required
      status checks enabled; reference this change's id so the TODO is
      traceable

## 3. Spec delta

- [ ] 3.1 Add `openspec/specs/ci-merge-gate/spec.md` with the ADDED
      requirements below

## 4. Verification

- [ ] 4.1 `pnpm uat:audit` exits 0 standalone
- [ ] 4.2 `git commit --dry-run` style check: manually trigger `.husky/pre-push`
      logic by running `SKIP_PREPUSH=1 sh .husky/pre-push` and confirm it
      prints the skip message and exits 0 (the automatic invocation on real
      `git push` is out of scope for a scripted check)
- [ ] 4.3 `npx openspec validate server-side-merge-gate --strict`
