# Tasks

## 1. Local stand bootstrap

- [x] 1.1 Add executable real-OpenSSL regression cases for incomplete, malformed, mismatched, reused, and fresh pairs plus generation/conversion errors; preserve the pre-fix RED receipt.
- [x] 1.2 Validate existing identity and propagate preparation failures in setup.sh; verify the certificate regressions and existing secret-preflight suite are GREEN.

## 2. Planning and delivery

- [x] 2.1 Validate this OpenSpec change, focused formatting, shell syntax and diff cleanliness; hand the source diff and RED/GREEN receipts to the root coordinator for independent review and six gates.

## Workflow follow-up

- Root coordinator owns commit, Astra review, and `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm spec:check` on the reviewed tree. These have not been run by this subtask.
