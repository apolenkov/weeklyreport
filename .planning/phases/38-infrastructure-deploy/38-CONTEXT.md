# Phase 38: Infrastructure & Deploy — Context

**Gathered:** 2026-05-05 (post-hoc; 38-01 + 38-04 shipped; 38-02 caddy + 38-03 SAML mock residual)
**Status:** Ready for planning (residual: 38-02 caddy reverse-proxy, 38-03 SAML hardening docs+mock)
**Mode:** Post-hoc scaffold — full milestone detail in `.planning/milestones/v8.0-ROADMAP.md`

<domain>
## Phase Boundary

Make the codebase deployable to a single host with `docker compose` from a clean checkout: hardened prod compose with required env fences, migration init-container, reverse-proxy with auto-TLS, RUNBOOK + incident playbook, SAML hardening at docs+mock scope (real Keycloak deferred to v8.1).

In scope: docker-compose.prod.yml hardening (every prod env required via `${VAR:?msg}`, SMTP/SAML real, /health/ready healthcheck, apilogs volume); apps/api/scripts/migrate.sh wrapper; caddy reverse-proxy with auto Let's Encrypt + healthcheck integration; samlify-based SAML round-trip integration test; RUNBOOK with 10 failure modes + INCIDENT-PLAYBOOK with rollback + on-call template + postmortem template.

Out of scope: K8s / Helm chart (deferred until org demands; user confirmed "локальная контейнеризация" 2026-05-05); live Keycloak service in compose (38-03 stays mock-only — real IdP is org-side); CDN for static assets (v8.1+).
</domain>

<decisions>
## Implementation Decisions

- **Migration strategy:** init-container not in-process. The api `depends_on: { migrate: { condition: service_completed_successfully } }`. Migration failures crash the migrate container, the api never starts, ops sees one signal not two.
- **Reverse-proxy choice:** caddy (not nginx). Auto-TLS via Let's Encrypt is built-in; configuration is one Caddyfile. Fallback to caddy local CA for staging when LE rate-limits hit.
- **SAML test scope (38-03):** docs + samlify mock integration test, NOT a live Keycloak container. Real IdP is the customer org's responsibility; we ship cert-pinning + signed-assertion validation + replay-rejection tests against a deterministic mock.
- **RUNBOOK structure:** 10 failure modes (DB down, Redis down, SMTP fail, migration fail, DLQ growth, SAML 500, PDF stuck, disk full, 5xx spike, TLS expired) with detect → triage → resolve → escalate per entry. INCIDENT-PLAYBOOK has SEV matrix + rollback (incl. across destructive migrations) + on-call rotation template + 5-section postmortem template.

</decisions>

<code_context>

## Existing Code Insights

- `Dockerfile.api` and `Dockerfile.web` already exist — multi-stage, non-root user, ~150MB web image. No changes needed for v8.0; they served migrate + api roles from one image.
- `docker-compose.yml` (dev) was previously NODE_ENV=production+AUTH_DEV_MODE=true (which the new 36-03 fence rejects). Flipped to NODE_ENV=development in 38-01.
- Existing `docker-compose.prod.yml` from April 13 had basic shape; 38-01 hardened it with `${VAR:?msg}` everywhere, SMTP/SAML required, healthcheck on /health/ready, apilogs volume.
- `RUNBOOK.md` and `INCIDENT-PLAYBOOK.md` are new files at repo root — README links to both.

</code_context>

<specifics>
## Specific Ideas

- 38-02 caddy: Caddyfile in `deploy/caddy/`; service in docker-compose.prod.yml; healthcheck pings caddy admin API; WS upgrade for tRPC subscriptions if/when added.
- 38-03 samlify mock: integration spec creates a deterministic IdP keypair, signs an assertion, asserts our SP accepts it, then mutates one byte of the signature and asserts SP rejects. Replay test: replay the same signed assertion within the validity window twice, second one rejected.
- 38-04 RUNBOOK: every failure mode entry has runnable commands (docker compose exec, psql, redis-cli, curl) — operator can copy-paste without thinking.

</specifics>

<deferred>
## Deferred Ideas

- Live Keycloak in compose — v8.1 if customer wants on-prem IdP testbed.
- K8s manifests / Helm chart — deferred until org demands.
- Multi-region / DR — deferred (RUNBOOK acknowledges single-region for now).

</deferred>
