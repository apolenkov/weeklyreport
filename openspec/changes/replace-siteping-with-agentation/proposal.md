## Why

WeeklyReport currently couples its authenticated feedback surface to SitePing's
widget and transport. Agentation 3.0.2 provides the required in-page annotation
UI, and `agentation-mcp` 1.2.0 provides an agent-facing loop, but neither
package is a PostgreSQL, SSO, or multi-tenant WeeklyReport backend. A direct
SQLite deployment would create a second source of truth and would not bind
feedback to the authenticated WeeklyReport user.

## What Changes

- Replace the SitePing widget integration with `agentation@3.0.2`.
- Run `agentation-mcp@1.2.0` in `--mcp-only --http-url` mode against a
  same-origin WeeklyReport adapter, rather than exposing its stock HTTP server.
- Keep WeeklyReport PostgreSQL and its existing feedback repository as the
  canonical store; translate the Agentation wire protocol at the adapter.
- Derive immutable `userId`, role, group, product, and ownership only from the
  authenticated server session. Ignore or reject client identity fields.
- Support sessions, annotations, placement/rearrange annotations, status,
  threads, actions, pending queries, and authenticated SSE event replay.
- Use the stock Agentation element/area-selection workflow as the only new
  feedback creation surface, including feedback about the page as a whole.
  Remove the separate first-party page-comment dialog and its legacy create
  transport.
- Make deletes non-destructive status transitions and preserve legacy SitePing
  rows and captured evidence.
- Fail closed unless explicit non-production/development configuration enables
  the surface. Stock Agentation SQLite is not a WeeklyReport persistence path.

### Non-goals

- No production database reset, destructive migration, or migration-history
  rewrite.
- No anonymous links, browser-held authority, wildcard CORS, or public stock
  Agentation HTTP server.
- No CoreDev ingress or cross-product tenant authority in this change.
- No mandatory 20-case real-browser comparison: the current evidence does not
  contain a reproducible SitePing baseline and real fixtures for all 20 cases.
  Add that comparison only when both implementations and fixtures exist.
- No deletion or modification of `process-current-feedback-batch`.

## Capabilities

### Modified Capabilities

- `authenticated-product-feedback`: replace the SitePing transport contract
  with an authenticated Agentation-compatible adapter and preserve product
  feedback lifecycle and data guarantees.

## Impact

The implementation affects the web feedback widget, the same-origin API
adapter, shared feedback wire types, the MCP launch contract, and focused
API/web/browser tests.
