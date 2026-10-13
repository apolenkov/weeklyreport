# Tasks

## 1. API

- [x] 1.1 Retain the public late-malformed-repair lease-loss control and reproduce the deadline failure through the real planner adapter and transport, an injected fetcher, the production deadline callback and a live lease; prove the adapter resolves a valid-wire invalid-plan result and record baseline GREEN and intended adapter RED with exact argv and source hashes in the external wave-08 handoff.
- [x] 1.2 Check cancellation immediately after awaited planner repair and before parsing; verify deadline `provider_unavailable`, lease-loss `resource_limited`, ordinary `invalid_plan` and focused service, adapter, transport, retry and retrieval unit tests (75 passed across six files).

## 2. Planning and verification

- [x] 2.1 Run API typecheck, scoped ESLint/Prettier, `pnpm spec:check`, own-change strict validation and scoped `git diff --check`; retain exact commands, exits and hashes in `~/work/handoffs/task-503/wave-08/c1757-receipt.json` and `c1757-green.log`.
- [ ] 2.2 Coordinator runs `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm spec:check` on the reviewed tree, obtains independent review at the accepted injected-fetcher integration boundary, and delivers with normal hooks.

This package proves public service, real adapter and real transport behavior with the production deadline callback under controlled timers and an injected fetcher. It does not claim native fetch or real-network behavior, or close the whole registry candidate before coordinator acceptance.
