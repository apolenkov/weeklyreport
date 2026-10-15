# Proposal

## Why

Installing dependencies in a disposable linked worktree can redirect shared Git hooks to that worktree and break later commits after its removal. TASK-503.101 and owner instruction 008 require the root `package.json` prepare lifecycle to preserve permanent-checkout hook ownership.

## What Changes

- Skip Lefthook installation with a clear message when Git's directory and common directory differ.
- Retain ordinary installation and its failures in the main checkout.
- Preserve successful no-Git/Docker skips.
- Exercise the actual prepare command against isolated Git repositories.

## Capabilities

### New Capabilities

- `git-hook-installation`: Checkout-aware ownership of prepare-time Git hook installation.

### Modified Capabilities

None.

## Impact

Only the root prepare command, its operations regression test, and this change are affected. `Dockerfile.api` and `Dockerfile.web` install from pruned manifests before copying source; keeping the guard inline preserves that path. Dependencies and the lockfile are unchanged.

## Non-goals

- Rebinding or changing shared hook contents or execution.
- Dependency upgrades, application behavior, Backlog or delivery-policy changes.
