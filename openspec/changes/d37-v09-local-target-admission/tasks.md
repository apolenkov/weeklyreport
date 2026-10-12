# Tasks

## 1. Local dependency target owner

- [x] 1.1 Add shared exact-context admission and pinned kubectl calls to up/down; verify the existing local-dev-contract subprocess regression moves from genuine RED to GREEN with foreign and allowed controls.
- [x] 1.2 Retain targeted formatting, shell syntax, scoped lint/diff and strict change validation receipts alongside the reviewable patch.

## 2. Tester target admission

- [x] 2.1 Extract shared target admission in guard.sh and apply pinned stop operations; verify genuine unsafe-target RED and both supported stand controls become GREEN without a live API pod.

## 3. Coordinated acceptance

- [ ] 3.1 Root verifies the relevant native target boundary under its authorized lane and runs aggregate pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build, pnpm spec:check on the integrated tree before archival; tie receipts to source SHA.
