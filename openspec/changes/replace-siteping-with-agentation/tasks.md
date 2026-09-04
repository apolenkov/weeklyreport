## 1. Contract and dependencies

- [x] 1.1 Pin and verify `agentation@3.0.2` and `agentation-mcp@1.2.0` against
      the published git heads, tarball hashes, integrity values, and license.
- [x] 1.2 Define shared Agentation-compatible schemas for sessions,
      annotations (including placement/rearrange), threads, actions, pending
      results, and SSE events with bounded payloads and stable client IDs.
- [x] 1.3 Document the short-lived/loopback agent credential and fail-closed
      development/non-production configuration; explicitly reject stock SQLite as
      a product store.

## 2. Authenticated PostgreSQL adapter

- [x] 2.1 Implement same-origin health/session/annotation/pending routes over
      the existing PostgreSQL feedback repository, deriving all identity, product,
      role, group, and ownership values from server session/agent auth.
- [x] 2.2 Implement status transitions, non-destructive DELETE compatibility,
      append-only threads, action delivery/audit, retry-safe creates, and preserve
      legacy SitePing rows and evidence.
- [x] 2.3 Implement scoped SSE for session/global agent streams, initial sync,
      sequence IDs, `Last-Event-ID` replay, reconnect behavior, and event redaction.

## 3. Agentation UI and MCP integration

- [x] 3.1 Mount Agentation only in the explicitly enabled authenticated
      non-production surface and remove SitePing runtime coupling for new traffic.
- [x] 3.2 Run MCP as `agentation-mcp server --mcp-only --http-url
<authenticated-adapter-url>` and verify all documented tool mappings.
- [x] 3.3 Keep the role-aware inbox and deterministic page/annotation links;
      verify placement/rearrange and thread/action states without changing report
      review lifecycle.
- [x] 3.4 Remove the separate page-comment UI and legacy feedback create route;
      use the unpatched stock Agentation element/area-selection workflow for all
      new browser feedback while preserving legacy inbox rows.

## 4. Acceptance and safety

- [x] 4.1 Run focused adapter/shared/API/web tests covering anonymous 401s,
      spoofed identity and product-scope rejection, two users, role/group scope,
      pending, status, thread, action, SSE replay, retries, and non-destructive
      delete; require all tests to pass.
- [x] 4.2 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
      `pnpm build`, `pnpm spec:check`, and
      `openspec validate replace-siteping-with-agentation --strict`; require all
      commands to pass before release.
- [x] 4.3 Verify source-built React 19/Next 16 behavior in a real browser at
      the repository's supported viewports with zero console/network errors and
      production fail-closed behavior. Do not use stale Docker images as evidence.
- [x] 4.4 Add the 20-case SitePing comparison only if a real, reproducible
      SitePing baseline and fixtures exist for all cases; otherwise record it as
      deferred evidence rather than claiming parity.
- [x] 4.5 Validate the forward-only migration statically, and apply it only to
      an exact disposable database explicitly authorized for this run; never reset,
      seed, or mutate production/shared/unknown data.
- [x] 4.6 Verify the single Agentation capture surface with focused web/API
      tests and source-built browser checks for an authenticated author and the
      admin-wide inbox, then rerun the repository gates affected by this delta.
