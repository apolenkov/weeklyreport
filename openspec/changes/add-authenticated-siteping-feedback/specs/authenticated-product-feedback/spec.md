## ADDED Requirements

### Requirement: Feedback attribution MUST be server-authoritative

The `/api/siteping` ingress MUST resolve an active WeeklyReport human session before every request. A created feedback MUST persist the session's immutable `userId` as `authorUserId`; displayed name/email and group scope MUST be derived by the server. Client-supplied identity, product, status, and ownership values MUST NOT control persistence or authorization.

#### Scenario: An authenticated client spoofs another author

- **WHEN** the POST body contains another person's name, email, product, group, or status
- **THEN** the stored row uses the verified session user, server-bound `weekly-report` product, session group, and initial open status
- **AND** no spoofed ownership field is persisted

#### Scenario: A session is missing or barred

- **WHEN** the cookie is missing, invalid, revoked, or belongs to a deactivated user
- **THEN** the ingress rejects the request before parsing feedback content or querying feedback rows

### Requirement: Feedback access MUST be scoped by method and role

The feedback repository MUST apply ownership and group predicates to reads and mutations. Active lead/viewer sessions MUST list, change status, and delete only their own rows. A head MUST list and change status only for own-group rows plus their own rows, and MUST delete only their own rows. The standard SitePing bulk-delete action MUST delete all rows owned by the active lead, viewer, or head. An admin MAY list, change status, delete any WeeklyReport row, and use bulk deletion to delete all WeeklyReport feedback.

Every active authenticated role MUST receive the SitePing creation widget. The authenticated `/feedback` page and its navigation entry MUST be available only to roles in the validated `NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES` allowlist. When enabled for a role, the page MUST render the same server-authorized scope: own rows for lead/viewer, own plus group rows for head, and all WeeklyReport rows for admin.

The SitePing widget MUST retain its standard feedback sidebar. The authenticated `/feedback` page MUST remain available as a role-aware inbox, and selecting a feedback item there MUST navigate to its recorded page with a SitePing deep link that focuses the corresponding DOM annotation.

#### Scenario: A lead requests the inbox

- **WHEN** a lead issues GET for WeeklyReport feedback
- **THEN** every returned row has that lead's `authorUserId`

#### Scenario: A head targets another group

- **WHEN** a head attempts to list or patch feedback outside their reporting group and not authored by them
- **THEN** the repository returns no foreign row or the ingress responds with a non-disclosing not-found/forbidden result

#### Scenario: A user deletes feedback

- **WHEN** a lead, viewer, or head issues DELETE for their own feedback
- **THEN** the repository deletes that row
- **AND** deletion of another user's feedback returns a non-disclosing not-found result

#### Scenario: A user deletes all visible feedback

- **WHEN** a lead, viewer, or head uses the standard SitePing bulk-delete action
- **THEN** the repository deletes every feedback row authored by that user
- **AND** feedback authored by another user remains unchanged

#### Scenario: An admin deletes all feedback

- **WHEN** an admin uses the standard SitePing bulk-delete action
- **THEN** the repository deletes every WeeklyReport feedback row

#### Scenario: The sidebar reloads after deletion

- **WHEN** SitePing reloads the same feedback query after an individual or bulk deletion
- **THEN** the ingress marks the feedback response as non-cacheable
- **AND** the sidebar renders the current repository state rather than a stale browser-cached list

#### Scenario: A user opens the standard sidebar

- **WHEN** any authenticated role opens the widget's message panel
- **THEN** the standard SitePing sidebar opens in place

#### Scenario: A user opens an annotation from the inbox

- **WHEN** an authenticated user selects an item on `/feedback`
- **THEN** the application navigates to the item's normalized page URL with its feedback id in the `siteping` query parameter
- **AND** the widget focuses the matching DOM annotation after the page loads

#### Scenario: A role is not enabled for the extended inbox

- **WHEN** an authenticated role is absent from `NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES`
- **THEN** `/feedback` is role-gated and its navigation entry is hidden
- **AND** the standard SitePing sidebar remains available

### Requirement: SitePing transport MUST remain behind the feedback module

WeeklyReport MUST pin `@siteping/adapter-prisma@0.6.4` and consume it only behind the authenticated feedback module interface. The application MUST NOT expose the stock public-read/API-key trust model or put a persistent SitePing key in a browser bundle.

#### Scenario: The widget submits feedback

- **WHEN** the authenticated widget sends a SitePing-compatible payload to the same-origin endpoint
- **THEN** the feedback module performs session resolution and authorization before delegating validation/storage behavior
- **AND** callers do not coordinate adapter, session, and Prisma details themselves

### Requirement: Capture MUST be bounded and role-scoped

The WeeklyReport widget MUST enable drawn annotations, right-click comments, screenshot capture, console/network diagnostics, marker visibility, the standard sidebar, and deep links for every active authenticated role. The ingress MUST accept only the pinned SitePing media types, field limits, and bounded diagnostic shapes. Persisted captures MUST remain protected by the same ownership/group/admin predicates as their feedback row. Persisted page scope MUST contain a pathname without query or fragment.

#### Scenario: A user submits captured context

- **WHEN** any authenticated role submits a valid screenshot with console and failed-network entries
- **THEN** the feedback row persists and returns the bounded capture
- **AND** a user outside the row's authorized scope cannot read it

#### Scenario: A client supplies oversized or malformed capture

- **WHEN** a POST exceeds the body limit or capture schemas
- **THEN** the ingress rejects the request before persistence

#### Scenario: The viewed URL has sensitive query data

- **WHEN** feedback is created from a URL containing a query or fragment
- **THEN** only the pathname is stored and returned as page scope

#### Scenario: A user starts a drawn annotation near the top navigation

- **WHEN** SitePing opens its fixed drawing-instruction toolbar
- **THEN** WeeklyReport places that toolbar at the bottom of the viewport
- **AND** the top navigation remains visible beneath the annotation canvas
- **AND** clicking over a visible navigation control draws instead of triggering the control

### Requirement: Failed submissions MUST NOT survive browser reloads

WeeklyReport MUST disable SitePing's durable browser retry queue. It MUST clear the pinned queue before widget initialization and after submission errors so rejected, deleted, or previous-identity payloads cannot be silently recreated on a later page load.

#### Scenario: A feedback POST fails

- **WHEN** the server returns a 4xx, 5xx, or network error and SitePing reports the failure
- **THEN** no `siteping_retry_queue` payload remains after the error callback
- **AND** reloading the application does not resubmit that payload

### Requirement: Feedback creation MUST be concurrency-safe

Two concurrent creates with the same `clientId` and author MUST create exactly one database row and return retry-safe non-500 responses. A duplicate owned by another author MUST NOT disclose that row. Only the exact feedback `clientId` unique constraint MAY enter this recovery path.

#### Scenario: Two same-author POST requests race

- **WHEN** both requests pass the initial lookup before either insert completes
- **THEN** one insert wins and the loser re-reads the same row
- **AND** both responses represent that row without a 500

#### Scenario: Another author reuses the client id

- **WHEN** the winning row belongs to a different authenticated user
- **THEN** the request fails without returning the foreign record

### Requirement: Inbox deep links MUST resolve deterministically

An authorized `/feedback` item MUST remain focusable when it is older than SitePing's first 20 rows. Canonical report redirects MUST preserve `siteping` and `sitepingUrl`, and key report blocks MUST expose stable `data-feedback-anchor` values used by SitePing reattachment.

#### Scenario: The target is outside the first page

- **WHEN** an authorized inbox link targets feedback outside the newest 20 for that page
- **THEN** the initial URL-scoped list includes that target without expanding its authorization scope
- **AND** SitePing scrolls to and highlights its annotation

#### Scenario: A report route redirects to its canonical URL

- **WHEN** a deep link enters through a non-canonical lead or head report URL
- **THEN** the canonical destination preserves the feedback id and recorded page scope

### Requirement: Product rollout MUST fail closed

Feedback ingress and web surfaces MUST remain unavailable unless validated configuration explicitly enables them. This change MUST enable only `weekly-report`; the reserved `external-product` discriminator MUST NOT create a external product ingress without a later SSO or short-lived signed-token specification.

#### Scenario: Configuration is absent or disabled

- **WHEN** WeeklyReport starts without explicit feedback enablement
- **THEN** the widget and inbox do not render
- **AND** `/api/siteping` does not expose feedback data or mutations

### Requirement: Feedback MUST remain separate from report review lifecycle

Creating, triaging, resolving, or deleting product feedback MUST NOT mutate report comments, review verdicts, acknowledgements, period state, or any companion lifecycle field.

#### Scenario: A head resolves product feedback

- **WHEN** a head changes an allowed feedback row to resolved
- **THEN** only the feedback status and resolution timestamp change
- **AND** no report or review record is written

### Requirement: Additive persistence rollout MUST respect the disposable guard

The Prisma schema and canonical init migration MUST stay synchronized. Any destructive recreation used to prove the migration MUST target only an exact database accepted by `prisma/guards/_destructive-guard.ts` with fresh per-run consent.

#### Scenario: Migration compatibility is verified

- **WHEN** the schema is recreated for acceptance
- **THEN** the guard proves the exact disposable target before reset or seed
- **AND** no production, shared, or unknown database is mutated
