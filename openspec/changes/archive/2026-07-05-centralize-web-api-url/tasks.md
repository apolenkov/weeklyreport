## 1. Environment supply (close the SET-side gap first)

- [x] 1.1 Make the web UNIT suite deterministic — it loads NO env file, so
      `.env.test` cannot feed it. In BOTH `get-server-session.test.ts` and
      `get-print-route-context.test.ts` add `vi.stubEnv("NEXT_PUBLIC_API_URL",
"http://localhost:3002")` (these tests drive `resolveApiUrl` with fetch
      mocked and pass today only via the removed fallback). Alternative: add a
      `test.env: { NEXT_PUBLIC_API_URL: ... }` block to
      `apps/web/vitest.config.ts`. Also add `NEXT_PUBLIC_API_URL` to
      `.env.test.example` for local integration-suite parity.
- [x] 1.2 Confirm the exhaustive SET-side inventory in `design.md` still holds
      (root `.env`, `apps/web/.env`, `apps/web/.env.local`, all three
      `docker-compose*.yml`, `ci.yml`, `e2e/sweep/playwright.config.ts`,
      `e2e/playwright.integration.config.ts` — the last two are accepted
      tooling-level self-defaults, not product config).
- [x] 1.3 Rewrite the `.env.example` `API_URL` comment (lines 155-157): it
      currently advertises a server-side `resolveApiUrl` default of
      `http://api:3001`; both cease to exist. New text: required, no default,
      resolved via `requireApiUrl`.

## 2. New server module

- [x] 2.1 Create `apps/web/src/lib/server/api-url.ts` (plain module, NO
      `server-only` import — `next.config.ts` imports it at Node config time).
- [x] 2.2 Implement `requireApiUrl()`: read `API_URL` then
      `NEXT_PUBLIC_API_URL`; throw a descriptive error naming both vars when
      neither is set; no localhost / default fallback.
- [x] 2.3 Implement `decodeTrpcBatchPayload(body): unknown` returning the first
      batch entry's inner payload (unwrapping the superjson `{ json }` wrapper),
      or `null` for a non-array/empty body, an `error` entry, or `null`/
      `undefined` `result.data`.
- [x] 2.4 Implement `shouldUseDevAuthFallback(): boolean` = `NODE_ENV !==
"production" && (AUTH_DEV_MODE === "true" || AUTH_DEV_MODE_ALLOW_TEST ===
"true")`.
- [x] 2.5 Add unit tests (`api-url.test.ts`) covering every spec scenario:
      unset-throws, `API_URL` precedence, public-only; wrapped/un-transformed/
      error decode; dev-on / production-off / dev-off predicate.

## 3. Rewire consumers

- [x] 3.1 `next.config.ts`: replace the inline chain with `requireApiUrl()`.
- [x] 3.2 `app/api/client-logs/route.ts`: replace the two-leg
      `API_URL ?? "http://localhost:3002"` (no public leg today) with
      `requireApiUrl()`. NOTE the intended behavior change — the route gains the
      `NEXT_PUBLIC_API_URL` precedence leg (design.md decision); verify no env
      that sets only `API_URL` for this route depends on excluding the public
      var.
- [x] 3.3 `lib/server/get-org-public.ts`: use `requireApiUrl()` +
      `decodeTrpcBatchPayload`; collapse `resolveApiUrl` and the envelope half
      of `decodeOrgPublicResponse` to a narrow-only step.
- [x] 3.4 `lib/server/get-server-session.ts`: use `requireApiUrl()`,
      `decodeTrpcBatchPayload`, and `shouldUseDevAuthFallback()`; keep the
      `UserSession` narrowing.
- [x] 3.5 `lib/server/get-print-route-context.ts`: same three seams; keep the
      `PrintRouteContext` narrowing.

## 4. Delete dead code

- [x] 4.1 Delete `apps/web/src/components/common/api-readiness-placeholder.tsx`
      (confirmed no importer); confirm no stale reference remains.

## 5. Verification

- [x] 5.1 Run `pnpm --filter @customreport/web db:generate` (prisma client can
      be wiped by pnpm ops), then `pnpm typecheck && pnpm lint && pnpm test`.
- [x] 5.2 Run `pnpm build` (exercises `next.config.ts` → `requireApiUrl` at
      config-load; must pass with the env var present).
- [x] 5.3 Confirm `apps/web/src/lib/server/api-url.ts` needs NO
      `eslint.config.ts` exempt entry (green with `--max-warnings 0`).
- [x] 5.4 Run `openspec validate "centralize-web-api-url" --strict`.
