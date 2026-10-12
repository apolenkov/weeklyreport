# Proposal

## Why

C5400 (card `ops-edge-forwarded-proto`): both proxied sites in the production
Caddyfile set `header_up X-Forwarded-Proto {scheme}`. The Ingress terminates
TLS and speaks plain HTTP to Caddy, so `{scheme}` is always `http` and
overwrites the trusted outer `https` that Caddy would otherwise keep. The web
app builds the absolute 307 login redirect in `apps/web/src/proxy.ts` from
`request.url`, whose scheme under `next start` follows `x-forwarded-proto`, so
the redirect can point at `http://`.

## What Changes

- Remove both `header_up X-Forwarded-Proto {scheme}` lines. Caddy's own
  forwarded-header handling then keeps the value from a configured trusted
  proxy and derives it from the connection otherwise, so clients cannot spoof it.
- A static contract test pins the absence of the override.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deploy-caddy-config`: the edge preserves the trusted forwarded protocol.

## Impact

`deploy/helm/weeklyreport/files/Caddyfile` (the Helm ConfigMap follows it) and
`scripts/gates/operations/operations-config-docs.test.ts`.

## Non-goals

- `X-Forwarded-For`, `X-Real-IP`, `Host`, HSTS, Express `trust proxy` and
  `apps/web/src/proxy.ts` do not change.
- The cookie `Secure` flag stays `NODE_ENV`-driven.
- Runtime proof needs a real Caddy and Ingress (native lane); the unit test
  checks the configuration text only. The fix relies on `edge.trustedProxies`
  covering the real Ingress peer; otherwise Caddy ignores the incoming header
  and still sends `http`, exactly as today.
