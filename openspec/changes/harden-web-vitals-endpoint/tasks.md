## 1. Shared payload contract

- [ ] 1.1 Add `webVitalBeaconSchema` (Zod) to `packages/shared`: `name` enum (`LCP`/`CLS`/`FCP`/`INP`/`TTFB`), `value` finite number, `id` non-empty string, `navigationType` optional string; export the inferred type
- [ ] 1.2 Add the `navigationType` whitelist set (`navigate`, `reload`, `back-forward`, `back-forward-cache`, `prerender`, `restore`) plus the `other` fallback constant in the same shared module as the single source of truth

## 2. Histogram instruments

- [ ] 2.1 In `apps/api/src/infrastructure/metrics/web-vitals.metrics.ts`, replace each `Gauge` with a `Histogram` keeping the same metric names and `navigation_type` label
- [ ] 2.2 Declare metric-appropriate `buckets` per vital: millisecond buckets for `LCP`/`FCP`/`TTFB`/`INP`, small score buckets for `CLS` matching the unit the web sender emits (verify the sender first)

## 3. Controller hardening

- [ ] 3.1 In `apps/api/src/modules/observability/web-vitals.controller.ts`, parse the request body with `webVitalBeaconSchema.safeParse`; on failure return `400` and record nothing (throw `BadRequestException`, never let a malformed body 500)
- [ ] 3.2 Map `navigationType` through the whitelist to `other` for absent/unrecognised values before using it as the `navigation_type` label
- [ ] 3.3 Record the sample with `histogram.observe(value)` (not `gauge.set`); keep the existing per-name lookup map pointing at the histograms
- [ ] 3.4 Verify no hardcoded Russian in the changed `apps/api` files and no new lint/type errors

## 4. Rate limiting

- [ ] 4.1 Extend `createRateLimits` in `apps/api/src/infrastructure/throttler/rate-limit.middleware.ts` to also return a `vitalsLimiter` with a moderate per-IP/minute budget, bumped in test like the other tiers, using the existing `rateLimitHitsTotal` bucket accounting
- [ ] 4.2 Mount the `vitalsLimiter` on `/api/web-vitals` in `apps/api/src/main.ts`

## 5. Tests

- [ ] 5.1 Controller/unit test: well-formed body → 2xx and the histogram records; missing/non-numeric `value` → `400` with nothing recorded and no throw; unknown `name` → `400`
- [ ] 5.2 Test that an unrecognised and an absent `navigationType` both record under the `navigation_type="other"` label, and a recognised value records verbatim
- [ ] 5.3 Test that repeated `observe` calls accumulate into the histogram count/sum (distribution, not last-write-wins)
- [ ] 5.4 Rate-limit test: traffic over the vitals budget returns `429` and increments `rateLimitHitsTotal` for the vitals bucket

## 6. Verification

- [ ] 6.1 Run `pnpm typecheck`, `pnpm lint`, and the new tests; all green
- [ ] 6.2 Run `openspec validate "harden-web-vitals-endpoint" --strict` and confirm it passes
