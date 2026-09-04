# Agentation v3.0.2 + agentation-mcp v1.2.0: implementation audit for WeeklyReport

Date: 2026-09-04
Scope: exact published npm artifacts; no application/OpenSpec changes.

## Decision

Agentation can provide the requested out-of-box in-page UI and agent loop, but `agentation-mcp@1.2.0` cannot be used as WeeklyReport's source of truth without an adapter. Its built-in store is SQLite or memory; its HTTP API is a simple native Node server; its exported `createTenantStore` is not wired into the HTTP route handlers. The safe target is:

```text
Agentation React UI ──HTTP──► WeeklyReport same-origin adapter ──► existing PostgreSQL/domain inbox
                                      ▲
                              authenticated session
                                      │
                             immutable userId/role

Agentation MCP (--mcp-only --http-url adapter) ◄── HTTP/SSE contract ── adapter
```

The adapter must implement the Agentation wire protocol while deriving identity from the existing request session. It must never trust `authorId`, `userId`, `projectId`, or display-name fields supplied by the browser. If a first pilot is intentionally local-only, run Agentation MCP on loopback and accept the package's own SQLite; that is a developer tool, not the WeeklyReport product inbox.

## Reproducible version denominator

- `agentation@3.0.2`: npm registry metadata reports `gitHead=7dc5d65378fa901e6eead81d4e2bb62950d49f0b`, SHA-1 tarball `1f2745ae3a5b7acdb5d6fe2f9e6e482f3a39211a`, integrity `sha512-iGzBxFVTuZEIKzLY6AExSLAQH6i6SwxV4pAu7v7m3X6bInZ7qlZXAwrEqyc4+EfP4gM7z2RXBF6SF4DeH0f2lA==`, React peer `>=18`, and PolyForm Shield license ([registry metadata](https://registry.npmjs.org/agentation/3.0.2), [tarball](https://registry.npmjs.org/agentation/-/agentation-3.0.2.tgz), [published declarations](https://unpkg.com/agentation@3.0.2/dist/index.d.ts)).
- `agentation-mcp@1.2.0`: npm registry metadata reports `gitHead=b2d967a3887649b02283e86964aab25d24d0296b`, SHA-1 tarball `80d942f7f3047b937546e67c1d9de38cba16f84b`, integrity `sha512-BRHVm/YRyAHzJFM8i+ZbgpLgpnVptyKeUyauYd2pkOBX/oVFYGOjjLU+YtpNZD1Np+5/jJAp9xFbv1SE112Wwg==`, Node `>=18`, dependencies `better-sqlite3`, `zod`, and MCP SDK, and PolyForm Shield license ([registry metadata](https://registry.npmjs.org/agentation-mcp/1.2.0), [tarball](https://registry.npmjs.org/agentation-mcp/-/agentation-mcp-1.2.0.tgz), [published source map](https://unpkg.com/agentation-mcp@1.2.0/dist/cli.js.map)).
- The package metadata declares React 18+ compatibility. The installed package README does not name Next.js, and the published material does not claim React 19/Next.js 16 as a tested compatibility matrix. WeeklyReport must prove that combination with its own build and browser test ([Agentation repository](https://github.com/benjitaylor/agentation), [MCP docs](https://www.agentation.com/mcp)).

## React widget contract (`agentation@3.0.2`)

The published declaration defines `AgentationProps`: optional `endpoint`, optional pre-existing `sessionId`, `onSessionCreated`, `webhookUrl`, callbacks, and `copyToClipboard`. Without `endpoint`, persistence is browser `localStorage`; with it, the widget synchronizes to the HTTP server ([exact v3.0.2 declarations](https://unpkg.com/agentation@3.0.2/dist/index.d.ts)).

The `Annotation` wire shape contains required `id`, `x`, `y`, `comment`, `element`, `elementPath`, `timestamp`; optional selected text, bounding box, nearby text/elements, CSS/computed/accessibility data, React components, source file, drawing index, URL, `intent`, `severity`, lifecycle timestamps, `resolvedBy`, `thread`, `sessionId`, and **client-supplied `authorId`**. The adapter must ignore/rewrite `authorId` from browser payloads.

The exact v3.0.2 client implementation (embedded in the published bundle source map) performs these requests:

| UI operation      | Request                          | Body                                                                           | Expected response                                                            |
| ----------------- | -------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| health check      | `GET /health`                    | none                                                                           | any successful JSON response                                                 |
| discover sessions | `GET /sessions`                  | none                                                                           | JSON `Session[]`                                                             |
| create session    | `POST /sessions`                 | `{ url: string }`                                                              | JSON `Session` (HTTP 201 expected by current server)                         |
| join/read session | `GET /sessions/:id`              | none                                                                           | JSON `SessionWithAnnotations` with `annotations: Annotation[]`               |
| create annotation | `POST /sessions/:id/annotations` | annotation object; current server requires `comment`, `element`, `elementPath` | JSON server annotation (HTTP 201)                                            |
| edit annotation   | `PATCH /annotations/:id`         | `Partial<Annotation>`                                                          | JSON updated annotation                                                      |
| delete annotation | `DELETE /annotations/:id`        | none                                                                           | success; current server returns `{ deleted: true, annotationId }`            |
| send to agent     | `POST /sessions/:id/action`      | `{ output: string }`                                                           | `{ success, annotationCount, delivered: { sseListeners, webhooks, total } }` |

The widget also creates/deletes shadow annotations for `kind=placement` and `kind=rearrange`, so an adapter that only accepts “feedback” must either support those kinds or deliberately reject them with a clear UI failure. The client falls back to local storage on network errors and can later resync unsent records; this creates duplicate/idempotency pressure and requires a stable client ID or deduplication policy.

Source: [v3.0.2 published source map](https://unpkg.com/agentation@3.0.2/dist/index.js.map), [published types](https://unpkg.com/agentation@3.0.2/dist/index.d.ts).

## MCP HTTP contract (`agentation-mcp@1.2.0`)

`agentation-mcp server` starts the HTTP server and stdio MCP server in one process. `--mcp-only` skips the HTTP server; `--http-url URL` sets the URL that MCP fetches. Therefore a custom adapter is supported **at transport level**, provided it implements the exact paths and JSON/SSE shapes below. The MCP client uses native `fetch`; it adds `Content-Type: application/json` for POST/PATCH and adds `x-api-key` when `AGENTATION_API_KEY` is configured ([exact published MCP source map](https://unpkg.com/agentation-mcp@1.2.0/dist/cli.js.map), [CLI docs](https://www.agentation.com/mcp#server-options)). It does not send WeeklyReport cookies, so the adapter must authenticate this key separately from browser sessions.

### MCP tool-to-endpoint mapping

- `agentation_list_sessions` → `GET /sessions`, expects `Session[]`.
- `agentation_get_session` → `GET /sessions/:sessionId`, expects `SessionWithAnnotations`.
- `agentation_get_pending` → `GET /sessions/:sessionId/pending`, expects `{ count, annotations }`.
- `agentation_get_all_pending` → `GET /pending`, expects `{ count, annotations }`.
- `agentation_acknowledge` → `PATCH /annotations/:id` with `{ status: "acknowledged" }`, expects updated annotation.
- `agentation_resolve` → `PATCH /annotations/:id` with `{ status: "resolved", resolvedBy: "agent" }`; if summary exists, then `POST /annotations/:id/thread` with `{ role: "agent", content: summary }`.
- `agentation_dismiss` → `PATCH /annotations/:id` with `{ status: "dismissed", resolvedBy: "agent" }`; then thread `{ role: "agent", content: reason }`.
- `agentation_reply` → `POST /annotations/:id/thread` with `{ role: "agent", content: message }`, expects updated annotation.
- `agentation_watch_annotations` → SSE `GET /sessions/:id/events?agent=true` or `GET /events?agent=true`; it parses `data: <JSON>` events, ignores `annotation.created` with `sequence=0` (initial sync), and collects later `annotation.created` events into a batch.

### Required SSE shape

The HTTP server emits:

```text
event: annotation.created
id: 42
data: {"type":"annotation.created","sessionId":"...","timestamp":"...","sequence":42,"payload":{...Annotation}}

```

Documented/implemented event types are `annotation.created`, `annotation.updated`, `annotation.deleted`, `session.created`, `session.updated`, `session.closed`, `action.requested`, and `thread.message`. Session SSE supports `Last-Event-ID` replay; global SSE supports optional `?domain=...`, and agent connections receive pending annotations as sequence `0` followed by `sync.complete`. The current implementation sets `Access-Control-Allow-Origin: *`; the WeeklyReport adapter must replace this with same-origin/allowlisted CORS and authenticated authorization ([MCP API events](https://www.agentation.com/api#events-real-time-events), [published HTTP source](https://unpkg.com/agentation-mcp@1.2.0/dist/cli.js.map)).

### Action request shape

`POST /sessions/:id/action` receives `{ output: string }`, reads all annotations in the session, emits:

```json
{
  "sessionId": "...",
  "annotations": ["...Annotation objects..."],
  "output": "formatted Agentation output",
  "timestamp": "ISO-8601"
}
```

as `action.requested`, sends configured webhooks, and returns delivery counts. Webhook delivery is fire-and-forget and the source does not document signing or retry guarantees ([published HTTP source](https://unpkg.com/agentation-mcp@1.2.0/dist/cli.js.map), [webhook docs](https://www.agentation.com/webhooks)). The adapter must add an authenticated, auditable agent identity before resolving/replying.

## Persistence and PostgreSQL feasibility

The public server store exposes only `AGENTATION_STORE=memory|sqlite`; SQLite defaults to `~/.agentation/store.db`, and events are pruned by `AGENTATION_EVENT_RETENTION_DAYS` (default 7) ([API storage](https://www.agentation.com/api#storage)). There is no documented PostgreSQL adapter, Prisma adapter, SQL schema migration hook, or generic persistence interface accepted by the HTTP server.

The published MCP source map does contain a `createTenantStore` with SQLite tables for organizations, API keys, user-scoped sessions/events and `authorId`, but the route handlers shown in the same artifact call the global `createSession`, `listSessions`, `getSessionWithAnnotations`, etc. The CLI/server wiring initializes the ordinary memory/SQLite store; no option selects `createTenantStore`, and the HTTP handlers do not enforce its user predicates. This is useful source material for a fork, not evidence of supported PostgreSQL/custom-store operation ([exact v1.2.0 bundle/source map](https://unpkg.com/agentation-mcp@1.2.0/dist/cli.js.map)).

Conclusion: implement a WeeklyReport adapter that translates Agentation requests to existing PostgreSQL, or fork the MCP package and replace the store plus HTTP auth. Do not point the stock server at a separate SQLite database and call that “integration”.

## Security and identity assessment

The stock local HTTP routes accept session creation, list, reads, PATCH, DELETE, thread writes and action requests without a documented auth middleware. The client sends no auth headers for its normal endpoint requests. The MCP client can send the optional static `AGENTATION_API_KEY` as `x-api-key` for every HTTP/PATCH/POST/SSE request, including `--mcp-only --http-url`, but that shared credential is not a WeeklyReport user session or SSO assertion. A client-provided `authorId` exists in the type and is persisted by the tenant store if used. These facts fail the WeeklyReport identity requirement unless an adapter derives identity server-side.

The minimum adapter rules are:

- require a validated WeeklyReport session on every browser request;
- derive `userId`, role, reporting group and product scope from that session;
- ignore/reject `authorId`, `userId`, author name/email and tenant/project authority in JSON;
- bind an Agentation session to a server-generated domain row and authenticated user;
- scope every GET/PATCH/DELETE/SSE/action/thread by product, role and ownership policy;
- authenticate the MCP side with a short-lived server-issued agent credential or a loopback-only process; do not expose stock global `/events`;
- replace wildcard CORS, add body/media/rate limits, and verify webhook signatures or keep webhooks internal.

## License and compatibility

Both published packages are PolyForm Shield 1.0.0, whose license prohibits using the software to provide a competing product/service ([Agentation LICENSE](https://github.com/benjitaylor/agentation/blob/main/LICENSE)). This is not an OSI-permissive license and must be reviewed before embedding, redistributing, or forking Agentation into a product offered to others. Internal use in the WeeklyReport team is a different legal posture, but not a reason to call it “MIT/open source”.

The React package declares React 18+ peers and uses a client component (`"use client"` in the published source). It is suitable for a Next App Router client boundary, but its package metadata does not establish a tested Next.js 16/React 19 matrix. Use development-only gating in WeeklyReport so the toolbar cannot accidentally ship to production; this is a host policy, not a package guarantee.

The current official API and MCP pages label Agentation as desktop-only. That is compatible with the local desktop review workflow used here, but it is an additional limit for browser-only or hosted-agent scenarios.

## Implementation recommendation

1. Build a narrow adapter contract against the existing product-feedback backend: translate the requests above, preserve evidence, map Agentation status/thread events to existing lifecycle semantics, and store the canonical record in PostgreSQL.
2. Mount `<Agentation endpoint="/api/agentation" ... />` only in an authenticated development/staging surface. Pass a server-issued session identifier only if the adapter binds it to the current session; do not use a user-chosen session ID as authorization.
3. Run MCP as `agentation-mcp server --mcp-only --http-url http://127.0.0.1:<adapter-port>` with `AGENTATION_API_KEY` in the local environment. The stock MCP process then supplies the agent UX while the adapter remains the source of truth.
4. Do not run SitePing in parallel for new traffic. Screenshot/console/network
   parity is deferred because Agentation's published browser contract does not
   provide those capture channels; the existing legacy rows remain readable.

### Pilot acceptance criteria

- 401 for anonymous create/read/update/delete/thread/action/SSE; 100% of persisted records have server-derived immutable `userId`.
- A payload containing a different `authorId`, `projectId` or display identity cannot change ownership or scope.
- Two users and two products cannot observe or mutate each other through sessions, `/pending`, global events, threads or MCP tools.
- All widget and MCP operations in the mapping above pass against PostgreSQL-backed adapter; SSE reconnect with `Last-Event-ID` and initial-sync sequence `0` are verified.
- Session and annotation creates are retry-safe through stable owner/path and client IDs; resolved audit evidence is not silently deleted. The published thread/action contract carries no idempotency key, so the adapter must not claim exact retry deduplication for those operations without a later protocol extension.
- React 19/Next 16 source build and real browser tests pass with production bundle absent; no stale Docker image is used as evidence.
- A later parity review may compare element/text/multi/area/placement/rearrange,
  route changes, DOM changes, and agent resolve/reply against the legacy
  baseline. Screenshot/console/network parity is explicitly deferred.
- License decision is recorded before any redistribution or public exposure.

## Final call

**Proceed with the direct PostgreSQL-backed adapter.** Agentation v3.0.2 + MCP
v1.2.0 is capable enough to improve local annotation and agent handoff, and
`--mcp-only --http-url` is sufficient to point the MCP client at the custom
WeeklyReport backend. It is not an out-of-box PostgreSQL, SSO, or multi-tenant
backend. Existing WeeklyReport PostgreSQL remains the only source of truth;
stock SQLite is not used by the product. Legacy SitePing rows remain readable,
while new traffic uses Agentation only. Screenshot/console/network parity is a
deferred follow-up, not a current Agentation capability.

## Management inbox: official operation matrix and decision

This section answers the current `/feedback` question against the published
`agentation@3.0.2` and `agentation-mcp@1.2.0` contracts. The official API lists
`GET /annotations/:id`, `PATCH /annotations/:id`, `DELETE /annotations/:id`,
and `POST /annotations/:id/thread`; the React API explicitly exposes callbacks
for add, delete, comment update, clear, copy, and submit. It does **not** expose
a separate admin-inbox component, admin permissions model, or a documented
bulk status-management UI ([official API](https://www.agentation.com/api#http-api),
[official props](https://www.agentation.com/api#props)).

| Inbox capability     | Official support      | Contract / meaning                                                                                                                                                                       | WeeklyReport decision                                                                                                                                                                   |
| -------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edit annotation text | Yes                   | `PATCH /annotations/:id` with partial annotation; React callback `onAnnotationUpdate` means the comment was edited                                                                       | The original author may edit; other reviewers reply without rewriting the request                                                                                                       |
| Acknowledge          | Yes, through MCP      | `PATCH` with `{ status: "acknowledged" }`; means seen and queued for attention ([MCP tool docs](https://www.agentation.com/mcp#mcp-tools))                                               | Prominent non-destructive action for triage                                                                                                                                             |
| Resolve              | Yes, through MCP      | `PATCH` with `{ status: "resolved", resolvedBy: "agent" }`; optional summary is added as an agent thread message                                                                         | Prominent after fix; retain row and evidence                                                                                                                                            |
| Dismiss              | Yes, through MCP      | `PATCH` with `{ status: "dismissed", resolvedBy: "agent" }` plus a reason in a thread message                                                                                            | Secondary action; require a reason and confirmation                                                                                                                                     |
| Human reply / thread | Yes                   | `POST /annotations/:id/thread` with `{ role, content }`; official MCP calls this reply for clarification or progress                                                                     | Secondary, beside the annotation detail                                                                                                                                                 |
| Delete               | Yes at protocol level | `DELETE /annotations/:id`; official HTTP API describes removal and emits `annotation.deleted` ([events](https://www.agentation.com/api#real-time-events))                                | Admin-only, one visible item at a time; Agentation keeps session, removes stored annotation events, and cascades annotation/thread; legacy ProductFeedback cascades annotation children |
| Bulk operations      | Format goal only      | Schema page mentions “clear all” and cross-page queries, but the published management contract documents no bulk REST endpoint or admin UI ([schema](https://www.agentation.com/schema)) | No bulk delete                                                                                                                                                                          |
| Session management   | Partial               | MCP exposes list/get session and pending queries; official types include `active`, `approved`, `closed` session states                                                                   | Show route/session context read-only; session close is not a default feedback-card action                                                                                               |

The official lifecycle is intentionally simple: `pending` → `acknowledged` →
`resolved`, with `dismissed` as the non-fix outcome. The MCP documentation says
acknowledge means “seen,” resolve follows addressing the feedback, dismiss
requires a reason, and reply is for clarification or updates
([official MCP tool details](https://www.agentation.com/mcp#tool-details)). The
React package's stock toolbar is a capture/sync surface, not the management
inbox: its documented props contain callbacks and endpoint/session wiring, but
no prop for injecting an admin action panel or changing lifecycle labels.

### Recommended `/feedback` hierarchy

For an admin card, make the following visible without opening a menu:

1. Status control with the current state and a clear transition to
   **Acknowledge** or **Resolve**. This is the primary triage path.
2. **Reply** near the message/thread, because it preserves clarification in
   the same record.

Put **Edit** in a secondary “More” menu or an explicit edit mode for the
original author only. Editing changes the human-authored request and should not
compete with status triage; other reviewers use Reply, preserving who said what.

Put **Dismiss / Won't fix** in the secondary/destructive visual group. It is
not data deletion, but it closes the actionable path; require a reason and
retain that reason in the thread.

`Delete` is a separate admin-only permanent action for exactly one visible item
from either source and must require explicit confirmation. Agentation keeps its
session, removes stored annotation events explicitly, and cascades
annotation/thread children; legacy ProductFeedback cascades annotation
children. It has no bulk form. `Dismiss` remains the routine non-destructive
path: it requires a reason and retains the row, thread, and captured evidence.

### Baseline gap addressed by this implementation

Before this change, `/feedback` exposed a status `<select>` for head/admin but
did not expose Agentation-specific Edit, Acknowledged, Dismissed, Reply/thread,
or a visible admin-only Delete action for either source in the card. The
baseline is visible in the previous revisions of
[`apps/web/src/features/product-feedback/ui/product-feedback-page.tsx`](../../apps/web/src/features/product-feedback/ui/product-feedback-page.tsx:139)
and
[`apps/web/src/features/product-feedback/ui/feedback-record-card.tsx`](../../apps/web/src/features/product-feedback/ui/feedback-record-card.tsx:157).
The API adapter, however, already accepts the corresponding Agentation
operations and maps the stock widget's DELETE to non-destructive dismissal at
[`apps/api/src/modules/product-feedback/agentation-wire.ts`](../../apps/api/src/modules/product-feedback/agentation-wire.ts:194).

The implemented inbox-management pass adds those actions and inline
thread/detail affordances, keeps status transitions prominent, keeps
edit/reply secondary, adds confirmation-gated admin-only single-item Delete,
and keeps Dismiss reasoned with retention semantics. This is a product UI
improvement, not a reason to patch or fork the Agentation package.

### Accessibility implications exposed by official sources

The official schema carries an `accessibility` field containing ARIA/role
context, which should remain visible in annotation detail when present
([schema optional context](https://www.agentation.com/schema#optional-context-fields)).
The published Agentation docs do not specify an admin-inbox keyboard model,
focus restoration, or screen-reader contract. WeeklyReport must therefore
accept those locally: every action needs an accessible name, status changes
must be announced, destructive/dismiss confirmation must be keyboard reachable,
and annotation context must remain readable inline without sending the reviewer
to another page. These are WeeklyReport acceptance requirements, not claims
about stock Agentation behavior.
