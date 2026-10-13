# Tasks

## 1. Local stand SQL

- [x] 1.1 Wrap all three statements in one transaction; verify that removing only the added BEGIN/COMMIT and surrounding blank lines recovers the exact base SQL bytes.
- [x] 1.2 Coordinator: run actual psql stdin with ON_ERROR_STOP=1 on an exact guarded synthetic target; preserve baseline late-FK failure residue, then verify rollback on corrected SQL, an uncovered user unique violation, successful complete provisioning, sequential replay, and retention of an existing non-null head pointer against the owning scenarios.

## 2. Planning and delivery verification

- [x] 2.1 Author: validate this OpenSpec change strictly, check changed Markdown formatting, and run git diff --check on owned paths; record exact commands and source hashes in the external handoff.
- [ ] 2.2 Coordinator: run pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build, and pnpm spec:check on the integrated reviewed tree; bind every result to its actual SHA.
- [ ] 2.3 Coordinator: obtain independent review, deliver through the authorized main workflow, and preserve separate unresolved C0139 concurrency and identity constraints in the final verdict.
