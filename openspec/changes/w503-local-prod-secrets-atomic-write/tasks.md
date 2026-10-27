# Tasks

## 1. Local stand bootstrap

- [x] 1.1 Interrupt the secret writer in the executable local-stand fixture and
      record the RED receipt: the partial file is reused and the next run
      deploys a truncated value.
- [x] 1.2 Publish `secrets.env` through a private temporary file and rename, and
      remove the temporary file on interruption; verify the fixture is GREEN and
      the existing local-stand regressions still pass.

## 2. Verification and handoff

- [x] 2.1 Run
      `vitest run --testTimeout=30000 scripts/gates/operations/local-prod-certificate.test.ts scripts/gates/operations/secret-preflight.test.ts`
      for the RED and GREEN receipts,
      `prettier --check --ignore-unknown scripts/gates/operations/local-prod-certificate.test.ts openspec/changes/w503-local-prod-secrets-atomic-write`,
      `eslint scripts/gates/operations/local-prod-certificate.test.ts`,
      `tsc6 --project tsconfig.scripts.json --noEmit`, `pnpm spec:check`,
      `bash -n deploy/local-prod/setup.sh`, and `git diff --check`; record the
      commands, exit codes and the exact SHA in the external wave report.
- [ ] 2.2 Hand the diff and RED/GREEN receipts to the root coordinator for the
      six repository gates, independent review, and integration.

## Workflow follow-up

Root coordinator owns commit, independent review, and `pnpm format:check`,
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm spec:check` on
the reviewed tree.
