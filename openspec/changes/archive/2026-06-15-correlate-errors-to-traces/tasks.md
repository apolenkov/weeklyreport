# Tasks — Correlate Bugsink Errors to OTel Traces

Status: implemented + fully live-verified 2026-06-15. Acceptance tests (AT1–AT6)
defined in `PLAN.md`. Live results — all green:

- AT1 ✓ — in-request error's trace_id resolved to its Tempo trace.
- AT2 ✓ — Tempo still receives traces at 100% in dev.
- AT3 ✓ — Bugsink holds errors only; server never sends transactions, and the
  browser's sampled pageload transaction was dropped by `beforeSendTransaction`.
- AT4 ✓ — a real browser emitted `sentry-trace` on the `/trpc` fetch; the header
  survived the Next rewrite and the api adopted the id (Tempo trace for that exact
  browser id carried the `GET /trpc/auth.me` server span). Verified end to end in
  a live browser (Playwright) against a parallel web instance on the new client.
- AT5 ✓ — api+browser DSN resolve to Bugsink project pk=1.
- AT6 ✓ — typecheck / lint / test / build all green.
- task 3.2 ✓ — client init loaded once (no double-init warning in the console).

Ops notes (environment, not code):

1. The Bugsink project was MISSING (its Docker volume had been reset since the
   handoff) — recreated as pk=1 `yourpulse-api` with the `.env` DSN key.
2. The web app reads its own `apps/web/.env*`, which does NOT carry
   `NEXT_PUBLIC_SENTRY_DSN` (only the root `.env` does). The live AT4 passed only
   because the parallel instance was started with the DSN injected. For browser
   correlation to actually run in dev, `NEXT_PUBLIC_SENTRY_DSN` must reach the web
   process (e.g. add it to `apps/web/.env.local`).

## 1. Backend — deterministic trace stamping (do first; proves the value)

- [x] 1.1 Add a `beforeSend(event)` to the api `Sentry.init` (`main.ts`) that
      reads the active span via `@opentelemetry/api`
      (`trace.getActiveSpan()?.spanContext()`) and stamps
      `event.contexts.trace.trace_id`/`span_id`.
- [x] 1.2 No-active-span branch: send the error as-is, without trace context.
- [x] 1.3 Add `beforeSendTransaction: () => null` to the api init.
- [x] 1.4 **AT1:** induce an in-request api error → Bugsink event has
      `contexts.trace.trace_id` → it resolves to a Tempo trace.
- [x] 1.5 **AT2:** confirm Tempo still receives traces at 100% in dev (no
      regression of the 2026-06-15 fix).

## 2. Backend — composite propagator for browser→api

- [x] 2.1 Declare direct deps in `apps/api/package.json`:
      `@sentry/opentelemetry`, `@opentelemetry/core` (currently transitive).
- [x] 2.2 Set the NodeSDK `textMapPropagator` to a `CompositePropagator`
      (W3C `traceparent` + `SentryPropagator`); leave exporter/sampler/
      instrumentations untouched.
- [x] 2.3 Encode precedence: W3C wins when present; Sentry bridges only requests
      lacking `traceparent`. Unit-test the both-present-different-ids case.

## 3. Frontend — update existing files

- [x] 3.1 `instrumentation.ts`: add
      `export const onRequestError = Sentry.captureRequestError`.
- [x] 3.2 Migrate the browser init to `instrumentation-client.ts`; delete
      `sentry.client.config.ts`; verify the client init loads in a real
      `next build` (no double init).
- [x] 3.3 Add `beforeSendTransaction: () => null` to client, server, and edge
      inits.
- [x] 3.4 Enable `browserTracingIntegration()` with `tracesSampleRate > 0`
      (1.0 dev) and `tracePropagationTargets` for same-origin `/trpc`,`/auth`,
      `/api` so the browser emits `sentry-trace` on api calls.
- [x] 3.5 Wrap `next.config.ts` with `withSentryConfig`; **disable source-map
      upload by default**, gated on the Bugsink sourcemap preflight (task 5).

## 4. Distributed-tracing acceptance

- [x] 4.1 **AT4:** assert the `sentry-trace` header on the **inbound Nest
      request** (survives the Next rewrite) AND that the resulting Tempo trace id
      equals the browser-originated id. ✓ live in a real browser — the SDK emitted
      `sentry-trace`, it survived the rewrite, and the api span resolved under the
      browser's trace id in Tempo.
- [~] 4.2 If AT4 fails (header lost / format mismatch) → degrade frontend to
  error-capture-only; move browser→api propagation to a separate spike.
  N/A — AT4 passed (header survives the rewrite, api adopts the id), so the
  degrade path was not triggered.

## 5. Env/ops + source maps

- [x] 5.1 **AT5 (required):** preflight api DSN, browser DSN, Bugsink project
      present/valid before running ATs.
- [x] 5.2 **AT5 (optional):** sourcemap upload token — verify `withSentryConfig`
      can target Bugsink's `sentry-cli` upload endpoint; otherwise run
      `sentry-cli sourcemaps inject/upload` as a separate build step.
- [x] 5.3 **AT3:** confirm no transaction events appear in Bugsink (any runtime).

## 6. Gates

- [x] 6.1 **AT6:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green.
