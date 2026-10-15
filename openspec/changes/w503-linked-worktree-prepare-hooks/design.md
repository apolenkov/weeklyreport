# Design

## Context

See proposal.md for the problem and TASK-503.101 scope. The existing prepare entry is a shell guard followed by `lefthook install`. Docker installers receive pruned manifests before repository scripts, so a new script would expand the build contract.

## Goals / Non-Goals

Use the existing prepare boundary to protect shared hooks. Hook execution, rebinding, dependencies and product invariants remain outside this change.

## Decisions

- Keep the guard inline in `package.json`, in its existing shell language. A separate TypeScript script would need Docker copy changes and add an unnecessary executable owner.
- Compare `git rev-parse --path-format=absolute --git-dir` and `--git-common-dir`. Absolute paths avoid spelling differences when invoked from a main-checkout subdirectory.
- Keep the initial no-Git success guard and finish the main branch with stock `lefthook install` so its output and exit status propagate.
- Use one Node-native TypeScript fixture test against the manifest's actual command. Real Git creates a main checkout and linked worktree; only the installer is a harmless PATH executable. Filter inherited Git environment and isolate global/system config and templates. Store temporary fixtures under the worktree's ignored output directory.

## Risks / Trade-offs

- Existing shared hooks may already reference another worktree → coordinator rebinds them separately using the permanent checkout's ordinary installer.
- Real pnpm lifecycle and Docker execution are not covered by shell fixtures → coordinator owns installation/build verification after review and resource admission.
- No period-state, authorization or database invariant changes; no migration or application rollout is needed.

## Migration Plan

Deliver the prepare entry and regression together. The coordinator performs the shared-hook rebind and normal installation checks. Reverting the prepare entry restores prior behavior but also its shared-hook ownership risk.
