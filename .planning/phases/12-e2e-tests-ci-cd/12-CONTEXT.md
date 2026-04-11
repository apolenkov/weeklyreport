# Phase 12: E2E Tests & CI/CD - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Automated Playwright CLI tests cover the full user journey; GitHub Actions CI pipeline runs on every push. E2E tests use dev-login auth bypass, no Keycloak dependency.

Requirements: E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, E2E-06, CI-01, CI-02, CI-03

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All decisions at Claude's discretion. Key constraints:
- Playwright CLI ONLY (not MCP) — user explicitly requested this
- Dev bypass auth via /auth/dev-login endpoint (sets cookie)
- Dual webServer in playwright.config (Next.js + NestJS)
- Docker services (postgres + redis) needed for real DB
- Per-role storageState fixtures (lead, head, viewer)
- GitHub Actions with Docker service containers

</decisions>

<specifics>
## Specific Ideas

- Playwright CLI, not MCP integration
- Consider adding to core-principles later

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
