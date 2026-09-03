## Context

SitePing's standard handler accepts Web `Request`/`Response`, validates its wire payload, and supports a custom `SitepingStore`. Its production Prisma schema persists browser-supplied `authorName` and `authorEmail` but has no immutable user identifier or WeeklyReport authorization scope. Reads can be public by default and a browser API key would be exposed. WeeklyReport already resolves signed same-origin session cookies, checks revoked/deactivated users, and carries `userId`, role, email, name, and reporting-group scope.

## Goals / Non-Goals

**Goals:**

- Reuse SitePing's transport/widget without delegating identity or authorization to the browser.
- Put session resolution, method authorization, product binding, and persistence behind one small feedback-module interface.
- Preserve a strict path from human identity to immutable feedback ownership.
- Support a future external product ingress without enabling an unverified identity path now.

**Non-Goals:**

- Generalizing all raw HTTP auth, replacing domain review comments, or exposing SitePing's API-key model.
- Webhook delivery, retention automation, external issue trackers, or a capabilities/permissions fork of SitePing's standard sidebar.
- Development SSO/token implementation in this change.

## Decisions

### Deep authenticated feedback module

The external seam is one handler factory mounted at `/api/siteping`. It accepts the existing session verifier/revocation checker, a feedback repository adapter, logger, and bounded configuration. Inside, it converts Express requests to the SitePing Web handler, derives access from the verified `UserSession`, rewrites identity/product fields, and maps responses. Callers do not coordinate SitePing validation, RBAC, or Prisma details.

Two repository adapters make the seam real: Prisma for production and in-memory for handler/authorization tests.

### Server-authoritative attribution and scope

`Feedback.authorUserId` is a required relation to `User`; `authorName` and `authorEmail` are server-derived display snapshots. `product` is server-bound to `weekly-report`. `authorReportingGroupId` snapshots the authenticated group when present. Client values for identity, product, status, and scope are ignored. `clientId` remains the SitePing idempotency key.

### Method authorization

| Method  | Access                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------- |
| POST    | any active authenticated role; create as self                                                     |
| GET     | lead/viewer: own rows; head: own reporting-group rows plus own rows; admin: all WeeklyReport rows |
| PATCH   | author on own row; head within own reporting group; admin across WeeklyReport                     |
| DELETE  | author on own row; admin across WeeklyReport                                                      |
| OPTIONS | same-origin preflight only; no data                                                               |

Every method first resolves the current signed session and rejects missing, invalid, revoked, or deactivated sessions. Mutations also require same-origin request metadata. SitePing API keys and public endpoint allowances are not used as the trust seam.

SitePing's standard message sidebar remains available to every authenticated role for native in-page browsing. The application also keeps `/feedback` as an optional role-aware cross-page inbox. `NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES` is an explicit, validated comma-separated allowlist; the initial deployment value is `admin`, while other canonical roles can be enabled without a code change. Each inbox item links to its normalized source page with the SitePing feedback id, allowing the widget's deep-link resolver to scroll to and highlight the matching DOM annotation.

### Bounded capture and page identity

WeeklyReport enables SitePing's full standard collection surface for every authenticated role: drawn annotations, right-click comments, screenshots, console/network diagnostics, marker visibility, sidebar browsing, and deep links. The ingress mirrors the pinned SitePing limits: screenshot data URLs are restricted to supported image media types and 1.5 MB, console/network arrays and individual fields are bounded, and the HTTP body limit admits one valid capture while rejecting oversized requests. Captures remain inside the same role-scoped feedback row. Network diagnostics never contain response bodies or request headers under the pinned widget contract. Feedback page scope remains pathname-only; query strings and fragments are not persisted as page identity.

### Drawing toolbar placement

SitePing 0.10.7 appends its 52 px drawing toolbar directly to `document.body` at the top of the viewport, where it covers WeeklyReport's navigation. The widget exposes annotation lifecycle callbacks but no toolbar-position option. On annotation start, the host schedules a post-activation microtask, identifies the pinned toolbar seam, and moves it to the viewport bottom without moving application content or the full-page drawing canvas. A compatibility test pins the upstream inline geometry so a SitePing upgrade fails visibly instead of silently restoring the overlap.

### No durable browser retry queue

SitePing 0.10.7 queues every failed POST, including permanent 4xx responses, in `localStorage`. WeeklyReport clears the pinned widget's `siteping_retry_queue` before initialization and whenever the widget reports an API failure. This intentionally disables cross-load delivery: a failed submission remains visibly failed and the user may submit again, but deleted or rejected payloads cannot silently reappear after reload or identity changes. A compatibility test pins the upstream storage key and callback ordering relied on by this narrow integration shim.

### Retry-safe creation

The Prisma repository retains the fast existing-row read, then treats only `P2002` on `SitepingFeedback_clientId_key` as a concurrent duplicate. It re-reads the winning row and returns it only when `authorUserId` matches the authenticated actor; a collision owned by another actor remains non-disclosing. Unrelated database failures propagate unchanged.

### Deterministic deep links and stable anchors

The widget adds the requested `siteping` id as a bounded same-origin request header. For the initial page-one URL-scoped list only, the scoped repository includes an authorized matching record ahead of the normal newest-first slice, so records older than SitePing's first 20 are available to its built-in focus routine. Canonical report redirects preserve `siteping` and `sitepingUrl`. `/feedback` builds role-correct canonical report links. Stable `data-feedback-anchor` values on key report section roots give SitePing a host-owned reattachment signal across rerenders.

### Product rollout

The durable product discriminator admits `weekly-report` and reserves `external-product`. Only `weekly-report` has an ingress in this change. Development requires a separate authenticated SSO or short-lived signed-token exchange; no anonymous fallback is allowed.

## Request Flow

Before:

```text
authenticated WeeklyReport UI -> no contextual product-feedback channel
```

After:

```text
widget -> same-origin /api/siteping -> human-session resolver
                                  -> method authorization
                                  -> SitePing-compatible handler
                                  -> scoped repository -> Prisma

all-role feedback page -> same endpoint -> scoped repository -> feedback rows
```

## Risks / Trade-offs

- [Browser spoofs author/product] -> overwrite them from session/config immediately before the SitePing handler.
- [Adapter bypasses role coverage] -> raw ingress gets focused method/role tests and reuses the existing human-session resolver; no hand-rolled tRPC chain is added.
- [Head reads another group] -> put ownership predicates in every repository query/mutation, not only UI filters.
- [Sensitive context is captured] -> use bounded upstream capture fields, keep them behind the existing role predicates, never persist request headers/response bodies, and keep page identity pathname-only.
- [Deleted feedback reappears from a browser queue] -> disable the pinned durable retry queue at widget startup and on submission error.
- [Two POST requests race on `clientId`] -> catch the exact unique constraint, re-read the winner, and enforce same-author disclosure.
- [An old inbox item cannot focus] -> prioritize the authorized deep-link id in the initial scoped list, preserve redirect parameters, and use stable host anchors.
- [Upstream `0.x` drift changes the wire contract] -> exact-version pin and compatibility tests at the module interface.
- [Single init migration drifts] -> edit schema and canonical init migration together, then recreate only an exact disposable database through the guard.

## Migration Plan

1. Add pinned dependencies and compatibility tests without mounting an ingress.
2. Add Prisma models and synchronize the canonical init migration; prove recreation on an authorized disposable target only.
3. Implement the repository interface with Prisma and in-memory adapters.
4. Mount the authenticated ingress behind explicit environment enablement; test every method/role/scope path.
5. Enable bounded captures and harden retry, concurrency, deep links, redirects, and stable anchors.
6. Mount the widget and role-configurable feedback page, then run browser acceptance on `http://localhost:3000`.
7. Enable WeeklyReport only after all gates pass. Development remains disabled.

## Rollback

Disable the feedback ingress/widget through the validated environment switch before reverting code. The additive tables remain inert during rollback; remove them only through a separately authorized migration because production data deletion is outside this change. No report lifecycle data is touched.

## Invariants

- Period dual-state: preserved; feedback writes never touch `Report` lifecycle fields.
- Role-coverage gate: preserved; no new tRPC procedure is hand-rolled. Raw ingress authorization has its own exhaustive method/role matrix.
- Destructive-database guard: preserved; schema recreation runs only against exact disposable targets with per-run consent.
