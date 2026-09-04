## ADDED Requirements

### Requirement: Authenticated users MUST be able to comment on the current page

Every active authenticated role that receives the feedback widget MUST also
receive an application-owned `Comment on page` action. Submission MUST use the
same authenticated feedback ingress, normalized pathname, server-authoritative
identity and role scope as contextual feedback. The stored record MUST contain
`annotations: []`; the client and server MUST NOT invent an element, selector,
rectangle, or zero-area anchor. The action MUST allow one supported feedback
type and a non-empty bounded message.

#### Scenario: A lead submits page feedback

- **WHEN** a lead submits a valid page comment from a URL containing query and fragment data
- **THEN** one open feedback row is stored with the lead's server-owned identity, normalized pathname, and zero annotation rows
- **AND** query and fragment data are not persisted

#### Scenario: Page feedback is rendered with contextual feedback

- **WHEN** an authorized inbox contains records with zero and non-zero annotations
- **THEN** the application labels them `Page feedback` and `Annotation` respectively
- **AND** both remain governed by the same role scope and workflow statuses

## MODIFIED Requirements

### Requirement: Feedback access MUST be scoped by method and role

The feedback repository MUST apply ownership and group predicates to reads and mutations. Active lead/viewer sessions MUST list, change status, and delete only their own rows. A head MUST list and change status only for own-group rows plus their own rows, and MUST delete only their own rows. The standard SitePing bulk-delete action MUST delete all rows owned by the active lead, viewer, or head. An admin MAY list, change status, delete any WeeklyReport row, and use bulk deletion to delete all WeeklyReport feedback.

Every active authenticated role MUST receive the SitePing creation widget and the application-owned page-comment action. The authenticated `/feedback` page and its navigation entry MUST be available only to roles in the validated `NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES` allowlist. When enabled for a role, the page MUST render the same server-authorized scope: own rows for lead/viewer, own plus group rows for head, and all WeeklyReport rows for admin.

The SitePing widget MUST retain its standard feedback sidebar. The authenticated `/feedback` page MUST remain available as a role-aware inbox. Selecting an annotated item with a stored screenshot MUST reveal the exact capture, highlight its recorded region, and expose its bounded console and failed-network diagnostics. The evidence view MUST retain a secondary live-page link with the SitePing focus query for cases where the current page can still reattach the DOM annotation. An annotation without a stored screenshot MUST retain the live deep link. Selecting page feedback MUST navigate to its recorded normalized page without a SitePing focus parameter or promise of a DOM marker.

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

- **WHEN** an authenticated user selects an annotated item with a stored screenshot on `/feedback`
- **THEN** the application reveals the captured page with the recorded annotation region highlighted
- **AND** the same evidence view shows console and failed-network counts and retains a secondary live-page link with the feedback id in the `siteping` query parameter

#### Scenario: An old annotation has no screenshot

- **WHEN** an authenticated user selects an annotated item without a stored screenshot
- **THEN** the application navigates to its normalized live page with the feedback id in the `siteping` query parameter

#### Scenario: A user opens page feedback from the inbox

- **WHEN** an authenticated user selects an item with no annotations on `/feedback`
- **THEN** the application navigates to the item's normalized page URL without a `siteping` query parameter
- **AND** the UI does not claim that an annotation was focused

#### Scenario: A role is not enabled for the extended inbox

- **WHEN** an authenticated role is absent from `NEXT_PUBLIC_PRODUCT_FEEDBACK_INBOX_ROLES`
- **THEN** `/feedback` is role-gated and its navigation entry is hidden
- **AND** the standard SitePing sidebar and page-comment action remain available

### Requirement: Capture MUST be bounded and role-scoped

The WeeklyReport widget MUST enable drawn annotations, right-click comments, screenshot capture, console/network diagnostics, marker visibility, the standard sidebar, and deep links for every active authenticated role. The ingress MUST accept annotated or page-level feedback only within the pinned SitePing media types, field limits, and bounded diagnostic shapes. Persisted captures MUST remain protected by the same ownership/group/admin predicates as their feedback row. Persisted page scope MUST contain a pathname without query or fragment.

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

#### Scenario: SitePing opens its drawing instruction surface

- **WHEN** SitePing opens its fixed drawing-instruction toolbar
- **THEN** WeeklyReport uses only the supported locale callback to shorten the instruction
- **AND** WeeklyReport does not inspect or rewrite SitePing's private injected DOM
- **AND** SitePing continues to own placement, Cancel, Escape, and drawing interception

#### Scenario: A user invokes the fast contextual path

- **WHEN** the user starts a right-click comment
- **THEN** the composer opens on the targeted element without showing the drawing-instruction toolbar
- **AND** the composer remains fully inside the viewport

### Requirement: Inbox deep links MUST resolve deterministically

An authorized DOM-annotated `/feedback` item with a stored screenshot MUST remain reviewable from its immutable capture even when the live DOM has changed or the reviewer role renders a different report surface. Live deep links older than SitePing's first 20 rows MUST remain retrievable. Canonical report redirects MUST preserve `siteping` and `sitepingUrl`, and key report blocks MUST expose stable `data-feedback-anchor` values used by best-effort SitePing reattachment. An annotationless page-feedback item MUST link to its normalized page without entering the marker focus path.

#### Scenario: The target is outside the first page

- **WHEN** an authorized inbox link targets annotated feedback outside the newest 20 for that page
- **THEN** the initial URL-scoped list includes that target without expanding its authorization scope
- **AND** SitePing scrolls to and highlights its annotation

#### Scenario: The reviewer renders a different report surface

- **WHEN** a head or admin opens a lead annotation whose live route maps to a different role surface
- **THEN** the inbox shows the original screenshot and highlighted annotation region as the authoritative review evidence

- **AND** a failed live reattachment does not hide or replace that capture

#### Scenario: A report route redirects to its canonical URL

- **WHEN** an annotated deep link enters through a non-canonical lead or head report URL
- **THEN** the canonical destination preserves the feedback id and recorded page scope

#### Scenario: Page feedback bypasses marker focus

- **WHEN** an authorized page-feedback item is opened from the inbox
- **THEN** the browser opens its normalized pathname without `siteping` or `sitepingUrl`
- **AND** SitePing does not report a successful focus for a marker that does not exist

## REMOVED Requirements

### Requirement: Failed submissions MUST NOT survive browser reloads

**Reason:** The requirement depended on SitePing's private local-storage key and
forced WeeklyReport to maintain an unowned retry-queue shim.

**Migration:** Remove the host queue mutation and leave submission retry
behavior owned by SitePing's public widget contract.
