# Tasks

## 1. API enqueue recovery

- [x] 1.1 Reproduce active replacement rejection with real Queue/Worker and add
      focused enqueue outcome/error-preservation tests; record intended RED.
- [x] 1.2 Recheck active replacement after failed removal; record focused GREEN
      and real Queue/Worker completion on the changed source.

## 2. Verification and delivery

- [x] 2.1 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
      `pnpm build`, and `pnpm spec:check`; commit with ordinary hooks and give
      the exact SHA and native receipts to the independent Astra reviewer.
