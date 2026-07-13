## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`deploy/caddy/Caddyfile.staging` ships no `Strict-Transport-Security` and no
`Content-Security-Policy` header at all — not even the `Report-Only` variant
the prod `Caddyfile` carries. Its `header` block (lines 56-61) only sets
`X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`; the prod
`Caddyfile` additionally sets `Strict-Transport-Security` (line 63) and
`Content-Security-Policy-Report-Only` (line 70). Staging is meant to be a
faithful pre-production rehearsal of the edge config (see the file's own
header comment: "staging or air-gapped envs"), so any header validated only
in staging today — including the eventual CSP enforcing flip — cannot be
exercised there, and the two files can silently drift further apart with
every future header change to the prod file.

Riding along as residual routing hygiene (Phase-A adversarial verification
demoted this from the originally-claimed P1: neither of the two mechanisms
that justified P1 — mis-keyed rate limiting, prod beacon degradation — holds
up; XFF is overwritten before the second hop and the beacon is compiled out
of prod images): the `@api` matcher in both `deploy/caddy/Caddyfile:34` and
`Caddyfile.staging:32` lists `/trpc /auth /health /admin/queues /pdfs` (each
bare and `/*`) but omits `/api /api/*`, so `POST /api/web-vitals` falls
through to `handle` (the `web:3000` catch-all) and only reaches the API via
the Next.js `/api` rewrite — an avoidable second hop for API-served traffic.

## What Changes

- `deploy/caddy/Caddyfile.staging`: add a `Strict-Transport-Security` header
  matching the prod directive (`max-age=31536000; includeSubDomains;
preload`) and a `Content-Security-Policy-Report-Only` header matching the
  prod directive verbatim, to the existing `header` block (lines 56-61).
  Staging keeps the same `Report-Only` posture as prod — the enforcing flip
  stays a single future change that touches both files together.
- `deploy/caddy/Caddyfile`: add `/api /api/*` to the `@api` path matcher
  (line 34) so `/api/*` is fronted directly by `api:3001` over one hop; the
  Next.js `/api` rewrite (`apps/web/next.config.ts`) becomes a dev-only
  convenience path, not a prod routing dependency.
- `deploy/caddy/Caddyfile.staging`: the same `/api /api/*` addition to its
  `@api` matcher (line 32), so staging cannot drift from prod on this
  matcher either.

## Impact

- `deploy/caddy/Caddyfile`
- `deploy/caddy/Caddyfile.staging`

Non-goals: no change to the CSP directive's `Report-Only` vs enforcing
posture (still pending in-browser validation across all role surfaces, per
the existing `TODO` in the prod file); no change to `apps/web/next.config.ts`
or the api's `trust proxy` config; no change to `main.ts`'s `vitalsLimiter`.
