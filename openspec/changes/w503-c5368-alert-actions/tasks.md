# Tasks

## 1. Web recovery composition

- [x] 1.1 Move the existing actions into AlertDescription in all three verified recovery callers; inspect the diff for unchanged callbacks, copy, pending state, and shared Alert source.
- [x] 1.2 Run the existing session and error-boundary focused behavior checks and record their results outside the product tree.
- [ ] 1.3 Verify native public session recovery at 1280 and 375 px against the recorded RED, including button/text bounds, keyboard focus/activation, pending state, successful recovery, and guarded private-lane cleanup.

## 2. Package acceptance

- [ ] 2.1 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm spec:check` on the final source; bind results and independent review to the delivered SHA.
