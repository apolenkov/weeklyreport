## Context

The published Agentation React package sends browser requests for health,
session discovery/creation, session reads, annotation create/update/delete,
thread writes, and session actions. The MCP package maps its tools to the same
HTTP resources and watches authenticated SSE streams. The stock server stores
memory or SQLite data and does not wire its tenant-store helper into the HTTP
handlers. It also has no WeeklyReport session middleware. Therefore the
integration boundary must be a first-party adapter, not a pointer to stock
SQLite.

## Decisions

### WeeklyReport owns persistence and identity

```text
Agentation UI -> same-origin adapter -> authenticated session -> PostgreSQL
agentation-mcp --mcp-only --http-url adapter -> authenticated agent boundary
```

Every browser request resolves the active WeeklyReport session before reading
or writing feedback. The adapter derives `userId`, role, reporting group and
`weekly-report` product scope server-side. `authorId`, `userId`, project,
tenant, author name/email, status, and ownership fields from JSON never grant
authority or overwrite these values. The MCP side uses a short-lived
server-issued credential or loopback-only process; it does not assume that the
stock MCP client forwards a WeeklyReport cookie.

### Implement the published Agentation wire surface

The adapter exposes the public paths required by Agentation 3.0.2 and MCP 1.2.0:

- `GET /health`, `GET /sessions`, `POST /sessions`, and
  `GET /sessions/:id`;
- `GET /sessions/:id/pending`, `GET /pending` with product/role scope;
- `POST /sessions/:id/annotations`, `PATCH /annotations/:id`, and
  non-destructive `DELETE /annotations/:id`;
- `POST /annotations/:id/thread` and `POST /sessions/:id/action`;
- `GET /sessions/:id/events?agent=true` and global events only when the
  authenticated agent policy allows them.

The adapter accepts the full annotation shape, including `placement` and
`rearrange` kinds, while bounding content using the existing feedback limits.
Stable client IDs make browser fallback/retry idempotent.

Inbox links carry both the Agentation session and annotation identifiers. The
pinned stock component accepts a session identifier but exposes no supported
API for programmatic annotation focus, so this change guarantees session
reconnection and URL continuity rather than claiming exact autofocus.
Every response is scoped and non-cacheable where mutable state is returned.

### Status, threads, actions, and events map to domain lifecycle

Agentation `acknowledged`, `resolved`, and `dismissed` operations map to the
existing product-feedback status model without changing report review state.
Agent replies and dismiss reasons become append-only thread evidence with an
authenticated agent identity. Actions emit an auditable action record and an
`action.requested` event. SSE emits the documented event names and JSON shape,
starts with sequence `0`/sync completion where required, supports
`Last-Event-ID` replay, and never leaks another product, group, or user.

### Deletes are not data deletion

The Agentation DELETE endpoint is retained for client compatibility but is
translated into the existing non-destructive resolved/dismissed transition.
Legacy SitePing rows remain queryable under their existing ownership rules;
no backfill or destructive table rewrite is needed. A separate archival or
retention policy is out of scope.

### Rollout and compatibility

The widget is mounted only on an authenticated development/non-production
surface behind explicit validated configuration. Missing or production
configuration disables the widget, inbox, adapter mutations, and SSE. The
adapter replaces wildcard CORS with same-origin/allowlisted origins and adds
body, annotation-content, and rate limits. A license review for PolyForm Shield
must precede redistribution or public exposure.

## Invariants

- PostgreSQL WeeklyReport remains the sole product-feedback source of truth.
- Feedback never mutates report comments, verdicts, period state, or lifecycle.
- Identity and role/group predicates remain server-authoritative on every
  method, including pending, thread, action, and SSE paths.
- Legacy rows and captured evidence are preserved.
- No stock Agentation SQLite file is used by the product or production path.
- Period dual-state and the tRPC role-coverage gate are unaffected.

### Evolve persistence additively

Agentation sessions and annotations need durable fields that do not exist in
the legacy capture tables, including thread history, design placement data,
and session lifecycle. A new forward-only Prisma migration adds dedicated
tables and foreign keys. The existing canonical init migration remains an
immutable baseline; no applied migration is edited, reset, or replayed.

## Evidence boundary

The research file `docs/research/agentation-v3-weeklyreport-implementation-2026-09-04.md`
records the published npm metadata, declarations, source maps, API paths,
SSE shapes, storage limitations, and license/compatibility findings. It is the
source-bound basis for this design; implementation must re-run the listed
version-denominator checks before release.
