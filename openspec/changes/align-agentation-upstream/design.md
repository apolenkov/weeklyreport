# Design: align with Agentation upstream

## Intent and boundary

WeeklyReport uses the published `agentation@3.0.2` browser component and
`agentation-mcp@1.2.0` MCP client as the protocol implementation. PostgreSQL,
server-derived identity, role/group predicates, URL privacy and inbox policy
remain WeeklyReport responsibilities. The stock Agentation HTTP server and
SQLite store are not introduced as a second product backend.

This design is grounded in the active requirements in
`replace-siteping-with-agentation`, `prevent-agentation-delete-resurrection`
and `upgrade-agentation-inbox`. The older SitePing wording is not treated as a
current source of truth. The package facts and public-export evidence are in
`upstream-analysis.md`.

## Concern-to-decision matrix

Every exception below names a product requirement and a concrete covering test;
“adapter tests” without a scenario are not sufficient evidence.

| Concern                                                        | Upstream reuse                                                     | WeeklyReport exception                                                                                             | Requirement preserved                                                       | Covering evidence                                                                                                                                                                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser capture, local storage, upload and native SSE consumer | Unmodified `Agentation` component and public `Annotation` types    | None                                                                                                               | One stock capture surface; no copied toolbar                                | `apps/web/src/features/product-feedback/agentation-sync.contract.test.tsx`: retained upload adopts server ID; dismissed replay clears native storage; terminal `annotation.updated` clears storage/closes stream                                  |
| HTTP session/annotation/thread/action resources                | Public paths and payload names                                     | Authenticated PostgreSQL adapter                                                                                   | Same-origin, server-authoritative identity and WeeklyReport source of truth | `apps/api/src/modules/product-feedback/agentation-upstream.integration.test.ts`: fixture creates session/annotation; public handler tests cover reads and mutations                                                                               |
| MCP tools                                                      | Stock `agentation-mcp` stdio client and its nine tool definitions  | HTTP base URL points to adapter; no custom MCP tool implementation                                                 | All documented agent workflows remain available                             | `agentation-upstream.integration.test.ts` asserts all nine tool names and exercises them against the adapter; five integration scenarios passed.                                                                                                  |
| Create retries and stable IDs                                  | Keep upstream POST shape                                           | Session/author locks and tombstones make create idempotent                                                         | Retry cannot duplicate rows or resurrect deleted content                    | `agentation-upstream.integration.test.ts` ownership/delete test exercises both client and server IDs; existing deletion integration tests cover overlap/serialization                                                                             |
| Authenticated browser identity                                 | Keep browser payload shape                                         | Resolve SSO/session server-side; ignore/reject client author/status/scope fields                                   | Immutable user, product, role and group attribution                         | Existing `product-feedback.handler.test.ts` spoofed identity/anonymous cases; upstream integration fixture sends spoofed `authorId` and `status` and asserts server values                                                                        |
| MCP identity                                                   | Stock client sends its configured key/header                       | Loopback/non-production agent credential is checked by adapter                                                     | Agent mutations and streams cannot be remote or anonymous                   | Existing handler tests for missing/invalid key and remote policy; integration test uses configured client against authenticated adapter                                                                                                           |
| Visibility and URL privacy                                     | Upstream session/annotation model                                  | Scope by user/group/role/product and normalize/redact URL/query data                                               | No cross-user/group/product disclosure; bounded context                     | Existing scope tests plus upstream fixture asserts `private` URL data is absent; wire contract schemas enforce bounds                                                                                                                             |
| Statuses                                                       | Stock acknowledge/resolve/dismiss calls                            | Map to WeeklyReport lifecycle and retain append-only evidence                                                      | `pending → acknowledged → resolved/dismissed`; no report lifecycle mutation | Integration test `supports stock reads, acknowledge, reply, resolve and dismiss` asserts final dismissed state, agent actor, thread and pending disappearance                                                                                     |
| Toolbar `DELETE /annotations/:id`                              | Keep endpoint and response compatibility                           | Translate toolbar DELETE to non-destructive `dismissed`                                                            | Browser delete cannot lose evidence and stale client cannot reappear        | `agentation-sync.contract.test.tsx` terminal dismissed replay; upstream integration delete test asserts persisted dismissed row and replay by both IDs                                                                                            |
| Inbox admin Delete                                             | No upstream equivalent is substituted                              | Separate single-item admin hard-delete command; cascade children/events, retain session and content-free tombstone | Explicit confirmation, admin-only, no bulk delete, no resurrection          | `agentation-upstream.integration.test.ts` asserts author DELETE is not inbox hard-delete and admin hard-delete removes row; `agentation-deletion.integration.test.ts` covers tombstone/replay/locking                                             |
| Threads/replies                                                | Stock `agentation_reply` maps to POST thread                       | Server derives actor/timestamp and stores append-only messages                                                     | Original annotation remains immutable to reviewers                          | Upstream integration stock flow asserts three agent thread roles/content; existing inbox action tests cover author/admin permissions                                                                                                              |
| Action request                                                 | Stock MCP has no WeeklyReport audit authority                      | Adapter records action and emits event; external webhooks disabled                                                 | Action is authenticated/auditable and does not call external systems        | `agentation.repository.test.ts`: appends thread messages and audits an agent action; upstream integration replays the public action event.                                                                                                        |
| SSE event names/payloads                                       | Preserve published names and JSON shape; stock watch consumes them | Authenticated scoped stream, no transform/compression, bounded initial sync and deletion replay                    | Scope-safe reconnect and no stale resurrection                              | `agentation-upstream.integration.test.ts` watch test receives newly created annotation; `agentation-sse.http.test.ts` covers framing/stream; deletion integration covers replay boundaries                                                        |
| SSE reconnect cursor                                           | Use `Last-Event-ID` protocol                                       | PG sequence cursor and deletion replay through captured sequence                                                   | Events after reconnect are not lost or replayed as ordinary deletes         | `agentation-deletion.integration.test.ts` snapshot-gap and deletion replay scenarios; SSE tests cover cursor parsing/continuation                                                                                                                 |
| Persistence                                                    | Use upstream wire schema/types                                     | Keep Prisma PostgreSQL tables/repositories and transactions                                                        | No SQLite product store, no data loss or migration reset                    | Prisma repository tests and disposable-DB integration lane; no stock store import in application code                                                                                                                                             |
| External webhooks/cloud                                        | Do not enable stock webhook/cloud path                             | Explicitly disabled                                                                                                | No external feedback transport                                              | Upstream integration asserts `/status` reports PostgreSQL, `webhooksConfigured: false` and zero webhooks; the audited adapter does not instantiate the stock cloud/webhook server. This is not a network-egress test.                             |
| Rollout                                                        | Keep component package behavior                                    | Fail closed in production/missing config; non-production only                                                      | Existing production safety boundary                                         | `product-feedback-widget.test.tsx` tests disabled, unauthenticated and production modes; `env.schema.test.ts` validates the opt-in flag. Server mounting is source-verified in `bootstrap/api-ingress.ts`; no bootstrap behavior test is claimed. |
| Placement/rearrange annotations                                | Preserve published fields and kinds                                | Validate/bound them in shared schemas and persist in PG                                                            | Full Agentation 3.0.2 annotation shape accepted                             | `packages/shared/src/schemas/feedback/agentation.test.ts` placement/rearrange cases; adapter wire contract tests                                                                                                                                  |

## Explicit non-goals

Browser-history restoration is one additional adapter responsibility. A live
Chrome back-navigation test retained a stale marker after Safari admin deletion.
The wrapper remounts the unmodified component using its React key only on
`pageshow` with `persisted: true`, restarting the public session/upload/SSE flow.
It does not read native storage or duplicate synchronization. This event is the
documented [cached-page restoration signal](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event).
`product-feedback-widget.test.tsx` verifies cached-only remount and listener
cleanup; the native sync contracts verify terminal cleanup on synchronization.
Live post-fix back-navigation on `/reports` returned to a connected toolbar with
no deleted marker; the scoped evidence and unrelated runtime failures are in
`acceptance.md`.

Do not import `src/server/*` from `agentation-mcp`, call private bundled
functions, patch `node_modules`, fork either package, switch product storage to
SQLite, weaken authentication, or change toolbar DELETE into hard deletion.
Do not promise exact annotation autofocus: the stock public component accepts a
session ID but exposes no supported focus-by-ID API. Do not add external
webhooks/cloud storage or a second page-comment capture path.

## Verification matrix

The focused contract denominator is:

- Web: unmodified component with only `fetch`/`EventSource` mocked. The test
  executes package sync/storage code and public types, not a copied source
  implementation.
- API/MCP: installed CLI/client against the authenticated adapter. The current
  reported run has **MCP 5 tests passed**; this document does not claim broader
  gates or browser/database runs passed.
- Existing API deletion/SSE/inbox suites remain required for the exceptions
  listed above. Real PostgreSQL scenarios may run only against the repository's
  explicitly guarded disposable targets (`customreport_e2e` or a permitted
  lane), never a shared/unknown database.

Required scenario coverage before closure:

| Contract          | Required scenarios                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create/read       | browser POST create, session read, pending read, all-pending scope, stable retry by client/server ID                                                             |
| Update/status     | author edit, acknowledge, resolve, dismiss with reason, forbidden foreign mutation                                                                               |
| Discussion/action | stock reply, server actor/timestamp, action request/audit, no external webhook                                                                                   |
| Delete            | toolbar DELETE→dismissed; admin single-item hard-delete; non-admin/foreign/bulk rejection; session retained; tombstone prevents recreation                       |
| SSE               | session/global policy, initial sync, event framing, no transform, `Last-Event-ID`, snapshot-gap deletion replay, continuation after replay, disconnect/reconnect |
| Security/privacy  | anonymous 401, remote/invalid agent credential rejection, spoofed fields ignored, role/group/product/URL scope and bounds                                        |
| Browser           | unmodified Agentation sync upload, server-ID adoption, dismissed stale cleanup, terminal update cleanup and EventSource close                                    |

## Reproducible dependency update procedure

Version ownership is explicit: `apps/web/package.json` owns
`agentation`; root `package.json` owns `agentation-mcp`; `pnpm-lock.yaml` is
generated evidence and must be changed only by the matching pnpm command.
The current `agentation:mcp` launcher invokes `dist/cli.js`, which is the exact
public `bin.agentation-mcp` entry declared by 1.2.0, not an internal server import.
Review this declared bin mapping as well as root exports on every MCP upgrade;
update the launcher if the public executable entry moves. Contract tests invoke
the package-manager-generated public executable instead of a compiled path.

1. Record the current baseline without reading secrets:

   ```bash
   git status --short
   pnpm list agentation agentation-mcp --depth 0
   pnpm why agentation
   pnpm why agentation-mcp
   ```

2. Choose an exact reviewed version from the official package/changelog, then
   update only the owning manifests with pnpm (no npm/yarn and no loose range):

   ```bash
   pnpm --filter @customreport/web add -D --save-exact agentation@<reviewed-version>
   pnpm add -w -D --save-exact agentation-mcp@<reviewed-version>
   pnpm install --frozen-lockfile=false
   ```

   For a one-package update, run only its command. Review the resulting diff;
   never edit lockfile or `node_modules` by hand.

3. Re-check the public boundary and official sources at the installed versions:

   ```bash
   pnpm list agentation agentation-mcp --depth 0
   pnpm --filter @customreport/web exec node -p 'require.resolve("agentation")'
   pnpm exec node -p 'require.resolve("agentation-mcp")'
   rg -n '"exports"|"version"' node_modules/.pnpm/agentation@*/node_modules/agentation/package.json node_modules/.pnpm/agentation-mcp@*/node_modules/agentation-mcp/package.json
   ```

   Compare the public bin, root exports and `.d.ts` signatures with `upstream-analysis.md`,
   and compare HTTP/SSE/status/delete behavior with the official [API](https://www.agentation.com/api),
   [MCP](https://www.agentation.com/mcp), and [changelog](https://www.agentation.com/changelog).
   A changed export, event, status, delete response, sequence, or auth behavior
   stops the update for review; unknown future versions are not presumed
   compatible.

4. Run focused checks first, then repository gates:

   ```bash
   pnpm --filter @customreport/web exec vitest run src/features/product-feedback/agentation-sync.contract.test.tsx src/features/product-feedback/agentation-web.contract.test.ts
   PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай' pnpm --filter @customreport/api test:integration src/modules/product-feedback/agentation-upstream.integration.test.ts src/modules/product-feedback/agentation-deletion.integration.test.ts
   pnpm format:check
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   pnpm spec:check
   openspec validate align-agentation-upstream --strict
   ```

   Run guarded disposable-PostgreSQL integration only when the run explicitly
   resolves an allowed target and passes the repository destructive guard and
   per-run consent; never reset or seed an unspecified database. Record command
   output, exact dependency versions, and any unrelated repository failures
   separately from Agentation evidence.

   `pnpm typecheck` is mandatory: Vitest execution alone does not evaluate the
   public `expectTypeOf` contract assertions. The integration command creates
   and removes only its own random fixtures; it does not reset or seed the DB.

5. Browser verification after an update must use source-built WeeklyReport at
   the canonical origin, test Safari Admin → Chrome Lead on distinct fixtures,
   and check console/network plus reconnect/delete behavior. Do not use stale
   Docker images as compatibility evidence. No commit or publication is part of
   this procedure.

## Stop conditions

Stop and ask the user before accepting an upstream change that requires a
storage migration, loses data/evidence, weakens access, changes product-facing
delete semantics, enables external egress, or requires private upstream
imports. A normal package version update may proceed only when the public
contract and the focused matrix above remain green.
