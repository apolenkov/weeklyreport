# Exemplary Code Standard

This is the current maintainability standard for WeeklyReport. Product code is
clear, typed, small, and tested. Repository checks enforce the
applicable rules.

## Principles

1. **Explicit configuration.** Required product configuration is validated at
   startup and supplied by the environment. Do not hide missing values behind
   silent defaults or fallbacks.
2. **Simple code.** Prefer named constants, narrow functions, and direct data
   flow. Remove magic values and unnecessary abstraction.
3. **Short rationale.** Comments explain only non-obvious current behaviour.
   Put durable product rules in `openspec/specs/` or an ADR, not in comments.
4. **Immutable boundaries.** Use `const`, avoid in-place mutation, and keep
   side effects at infrastructure boundaries.
5. **One responsibility.** A module owns one domain concern. Cross-domain work
   goes through an explicit service or contract.
6. **No suppressed failures.** Warnings, type errors, focused tests, and
   ignored checks are failures to resolve, not completion evidence.
7. **Current state only.** Every tracked file and directory has a live purpose
   in the current product, tests, documentation, or delivery path. Remove dead
   code, historical copies, compatibility layers, speculative fallbacks,
   generated residue, and empty structure instead of retaining them for a
   possible future need.
8. **One source of truth.** Define each contract, constant, and configuration
   value once at its owning boundary and derive every consumer from it. Do not
   keep duplicated manifests, parallel configuration paths, or documentation
   that restates a machine-readable contract and can drift.

## Verification

For changes to application code, build tooling, dependencies, or runtime
configuration, run the repository commands from `README.md` before delivery:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm spec:check
```

For changes limited to prose or agent instructions, check formatting of the
changed files (`pnpm exec prettier --check <files>`), verify referenced paths
and commands against their owning sources, and run `git diff --check` on those
files. Run `pnpm spec:check` when OpenSpec files change. This narrower local
acceptance does not replace CI or apply to executable examples, generated
contracts, or configuration that affects runtime behaviour.

Run the relevant application locally when a boot or integration path changes.
Keep the verification result tied to the exact commit being reviewed.

## OpenSpec

OpenSpec is the source of truth for non-trivial product behaviour. Read the
relevant specification before changing a contract. Create an active change for
new behaviour, implement its tasks, validate the change, and keep the durable
specification aligned with the current product.

## Review standard

- Product source, tests, configuration, and documentation describe the same
  current behaviour.
- Every retained repository artifact has a named live consumer or is the
  authoritative source for a current contract; duplicated or legacy paths are
  absent.
- Public exports have useful names and stable types.
- User-facing controls have accessible names, keyboard support, and visible
  focus states.
- Data writes preserve the invariants documented by the relevant specification.
- A change is complete only when its tests and repository gates pass.
