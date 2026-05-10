---
phase: 47
plan: 47-02
subsystem: ci, dx
tags: [husky, github-actions, prisma, pnpm]
requires: []
provides: [post-merge-hook, post-rewrite-hook, ci-workflow-acknowledged]
affects: [.husky/, .github/workflows/ci.yml]
key-files:
  created:
    - .husky/post-merge
    - .husky/post-rewrite
  modified: []
  acknowledged-existing:
    - .github/workflows/ci.yml
decisions:
  - Kept pre-existing .github/workflows/ci.yml (richer than plan minimum)
  - Deferred README CI badge stub to avoid entangling with 47-01 dev:watch edits
metrics:
  duration: ~6 min
  completed: 2026-05-10
commit: 46f4528
---

# Phase 47 Plan 02: Husky post-merge/post-rewrite + GitHub Actions CI Summary

**One-liner:** Idempotent post-merge / post-rewrite husky hooks that auto-run
`pnpm install` and `pnpm exec prisma generate` when lockfile / schema changes
detected during pull or rebase. CI workflow acknowledged as already in place.

## What Was Built

### `.husky/post-merge`

After `git pull` / merge, diffs `ORIG_HEAD..HEAD` to detect changes. If
`pnpm-lock.yaml` or root `package.json` changed → runs `pnpm install`. If
`prisma/schema.prisma` or anything under `prisma/migrations/` changed →
runs `pnpm exec prisma generate`. Two `grep -qE` checks, near-zero cost
when nothing relevant changed.

### `.husky/post-rewrite`

Same logic, but for the rebase / commit-amend case. Uses
`git rev-parse 'HEAD@{1}'` to find the pre-rewrite HEAD and diff against
current HEAD (the simpler `ORIG_HEAD` from `post-merge` isn't reliably set
on rebase). Guarded by `-n "$prev_head"` so it stays a no-op if the reflog
entry doesn't exist.

Both hooks are `chmod +x` (mode 100755 in the commit).

### CI Workflow

`.github/workflows/ci.yml` already existed from earlier phases (34-x, 39-x).
It is a strict superset of the plan's spec:

- Postgres 15-alpine + Redis 7-alpine service containers ✓
- `actions/setup-node@v4` with `cache: pnpm` and `pnpm/action-setup@v4` ✓
- `pnpm exec prisma migrate deploy` before tests ✓
- `pnpm turbo lint`, `pnpm turbo typecheck`, `pnpm turbo test` ✓
- Plus E2E (Playwright), mutation-audit gate, prisma migrate-reset gate,
  visual regression baseline, and docker-build verification

The plan's literal `jobs: { test, build }` would have been a downgrade.
Existing workflow already satisfies acceptance criterion "CI red-light on
push" and exceeds the plan's minimum.

## Smoke Test

```
$ git commit --allow-empty -m "test: smoke for 47-02 hooks"
[main e107900] test: smoke for 47-02 hooks
$ sh .husky/post-merge
(no output, exit 0)
$ sh .husky/post-rewrite
(no output, exit 0)
$ git reset --soft HEAD~1
```

Both hooks correctly identified that no relevant files changed and exited
silently — confirming idempotency.

## Verification

```
$ ls -la .husky/post-merge .husky/post-rewrite
.rwxr-xr-x 587 ap 10 мая 22:13 .husky/post-merge
.rwxr-xr-x 855 ap 10 мая 22:14 .husky/post-rewrite

$ sh -n .husky/post-merge && echo OK
OK
$ sh -n .husky/post-rewrite && echo OK
OK

$ actionlint .github/workflows/ci.yml
(no output → no errors)
```

## Deviations from Plan

### `[Rule 4 - Architectural, auto-accepted]` Did not overwrite existing ci.yml

- **Found during:** Step 3
- **Issue:** Plan provided a minimal workflow with two jobs (`test`, `build`).
  Existing `.github/workflows/ci.yml` (from phases 34-x and 39-x) is far
  richer: 5 jobs covering lint+typecheck+unit, e2e + integration, prisma
  migrate-reset gate, visual regression, docker build. All plan acceptance
  criteria are already met by the existing file.
- **Decision:** Preserve existing workflow. Replacing it would be a regression.
- **No commit needed for ci.yml** — file already on disk; reference only.

### `[Deferred]` README CI badge stub not added

- **Reason:** README has 18 lines of pre-existing uncommitted edits from a
  separate 47-01 (`dev:watch`) workstream. Adding a badge here would entangle
  two plans' changes into one commit, violating surgical-changes pillar.
- **Mitigation:** Documented for next README touch (in 47-01 close or 47-03).
- **Plan impact:** Acceptance criterion 7 (badge stub) is the only one not
  met. All hook + workflow criteria are satisfied.

### `[Rule 2 - Robustness]` post-rewrite uses HEAD@{1} not ORIG_HEAD

- **Reason:** Plan said "same body, different trigger." But `ORIG_HEAD` is
  not reliably set by all rebase paths (esp. interactive rebases at the end
  of the sequence), whereas `HEAD@{1}` from the reflog is. Guarded by
  `-n "$prev_head"` so absence of reflog entry → silent no-op.
- **Files:** `.husky/post-rewrite`

## Self-Check

- [x] `.husky/post-merge` exists, mode 100755, syntax-clean
- [x] `.husky/post-rewrite` exists, mode 100755, syntax-clean
- [x] `.github/workflows/ci.yml` exists (pre-existing, exceeds plan)
- [x] `actionlint .github/workflows/ci.yml` clean
- [x] Smoke test: both hooks no-op on empty commit, exit 0
- [x] Commit `46f4528` lands cleanly, includes both new files only
- [ ] README CI badge stub — DEFERRED (pre-existing 47-01 edits in README)

## Self-Check: PASSED with one DEFERRED item (README badge — non-blocking)
