# Change: The dev "Wipe + reseed" click is the per-run consent

## Why

Owner 2026-11-02, after the role-switcher "Wipe + reseed" failed on the lane A
stand with `[dev-reseed] … PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION must equal
"давай"`: "Это MVP … делай что хочешь". AGENTS.md already grants standing authority
for reset/reseed of exact guard-approved synthetic targets with no per-run approval,
but `wipeAndReseed` still demanded the consent variable in the API process
environment, so an explicit click by the operator was refused unless the server had
been started with that variable.

## What Changes

- In dev mode (`AUTH_DEV_MODE`), an authenticated `wipeAndReseed` call — an explicit
  operator action with an explicitly chosen variant — counts as the per-run consent.
  The procedure supplies the consent value to its own guard check and to its reset
  and seed child processes only.
- Unchanged: dev-mode gate, required variant, exact disposable-target allowlist,
  production refusal, one-at-a-time lock, safe responses and failure logging. Other
  destructive scripts and CLI paths still require the consent in their environment.

## Impact

- Spec: `destructive-db-guard` (ADDED dev reseed consent requirement).
- Code: `apps/api/src/infrastructure/trpc/routers/dev.router.ts` and its test.
