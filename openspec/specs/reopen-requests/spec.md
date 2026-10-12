# reopen-requests Specification

## Purpose

Define the scoped, race-safe request and decision lifecycle that lets a lead ask a head or admin to reopen a submitted section.

## Requirements

### Requirement: Reopen-decisioning is gated to head and admin

Reading, counting, and deciding reopen requests MUST be allowed for the `head`
and `admin` roles and MUST be forbidden for `lead` and `viewer`. The procedures
`listReopenRequests`, `respondReopenRequest`, and `pendingReopenCount` MUST be
built on the head-and-admin role chain (`headProcedure`), not the admin-only
chain. The admin Reopen Requests tab MUST keep working unchanged, because admin
is in the head allowlist.

#### Scenario: A non-admin head decides a request

- **WHEN** a session with role `head` (and no admin role) calls
  `listReopenRequests`, `pendingReopenCount`, or `respondReopenRequest`
- **THEN** the call succeeds and the head sees the queue, the pending count, and
  can approve or reject

#### Scenario: A lead or viewer is forbidden

- **WHEN** a session with role `lead` or `viewer` calls any of the three reopen
  procedures
- **THEN** the call is rejected with a forbidden error and no data is returned

#### Scenario: The admin tab is unaffected

- **WHEN** a session with role `admin` opens `/admin?tab=reopen`
- **THEN** the tab loads the requests, the pending badge, and the
  approve/reject actions

### Requirement: The head decides reopen requests from the dashboard

The head dashboard MUST present pending reopen requests with inline approve and
reject actions, so a head can decide a request without opening the admin panel.
The dashboard surface MUST read the same data as the admin tab
(`listReopenRequests` with the pending filter) and, on a decision, MUST
invalidate both the request list and the pending count so both surfaces stay in
sync. Approving MUST flip the target section from `submitted` to `draft`;
rejecting MUST leave the section submitted and record the optional head note.

#### Scenario: Head approves a pending request from the dashboard

- **WHEN** a head opens `/head/dashboard` with one pending reopen request and
  clicks Approve
- **THEN** the request becomes `approved`, the section flips to `draft` with
  `submittedAt` cleared, and the card and any pending-count indicator refresh to
  drop the decided request

#### Scenario: Head rejects with a note

- **WHEN** a head clicks Reject on a pending request and enters a note
- **THEN** the request becomes `rejected`, the section stays `submitted`, and the
  note is stored against the request

#### Scenario: Dashboard and admin tab do not diverge

- **WHEN** a head decides a request on the dashboard
- **THEN** the admin Reopen Requests tab, viewed afterward, reflects the same
  decided state with no stale pending row

### Requirement: A head sees and decides only their own group's reopen requests

Reopen-request reads and decisions MUST honor the same group scope every other
head dashboard read uses. For a `head` session, `listReopenRequests`,
`pendingReopenCount`, and `respondReopenRequest` MUST be limited to requests whose
section author is in the head's reporting group (the `reportSection` group-scope
filter). An `admin` session MUST remain global (no group filter). A head MUST NOT
be able to read, count, or decide a reopen request for a section outside their
group, even by passing its id directly.

#### Scenario: Head sees only in-group requests

- **WHEN** a head opens the dashboard and pending reopen requests exist for
  sections both inside and outside the head's reporting group
- **THEN** the list and the pending count include only the in-group requests

#### Scenario: Head cannot decide an out-of-group request by id

- **WHEN** a head calls `respondReopenRequest` with the id of a request whose
  section author is in another reporting group
- **THEN** the call is rejected and the request is unchanged

#### Scenario: Admin sees all requests

- **WHEN** an admin opens the Reopen Requests tab
- **THEN** the list and count include requests across all groups

### Requirement: The dashboard surfaces the pending reopen count

The head dashboard MUST surface pending reopen requests through a SINGLE
surface — the Reopen Requests card
(`apps/web/src/features/dashboard/ui/reopen-requests-card.tsx`) — and MUST NOT also
duplicate the pending reopen count as a separate indicator in the pending-lead
alert bar (`apps/web/src/features/dashboard/ui/alert-bar.tsx`). The pending
reopen count and its queue MUST
live only on the Reopen Requests card, whose header already shows the "N pending"
count; the alert bar's outstanding signals MUST be limited to lead-submission
signals (missing/late leads and the reminder action). The Reopen Requests card
MUST render whenever at least one reopen request is pending — even when every lead
has submitted — and MUST render nothing when the queue is empty. The alert bar
MUST self-suppress when there are no missing lead submissions, independent of the
reopen queue.

#### Scenario: Reopen requests show with zero missing leads

- **WHEN** a head opens the dashboard with every lead submitted but two pending
  reopen requests
- **THEN** the Reopen Requests card renders and shows its "2 pending" count and
  the approve/reject queue
- **AND** the pending-lead alert bar renders nothing (no duplicate reopen
  indicator)

#### Scenario: The reopen count is not duplicated in the alert bar

- **WHEN** the dashboard renders with pending reopen requests and one or more
  missing leads
- **THEN** the alert bar shows only the missing-lead signal and the reminder
  action, with no reopen-count line
- **AND** the pending reopen count and queue appear only on the Reopen Requests
  card

#### Scenario: Nothing outstanding hides both surfaces

- **WHEN** a head opens the dashboard with no missing leads and no pending reopen
  requests
- **THEN** the pending-lead alert bar renders nothing
- **AND** the Reopen Requests card renders nothing

### Requirement: A lead may file a reopen request only on an editable-lifecycle period

A reopen request MUST be permitted only when the section is editable after
approval, judged by the period lifecycle: `open` and `reopened` periods are
allowed; `published` and `archived` periods are forbidden. The server
(`requestReopen`) MUST enforce the rule and MUST be the single source of truth:
it MUST expose a server-computed `canRequestReopen` flag (with a reason when
false) on the lead-form read so the lead's Request reopen control is hidden
exactly when the server would reject the call — the web client MUST NOT
reconstruct the policy itself. When the reason is an existing pending request
(`pending_request_exists`), the lead form MUST show a "Reopen requested" status
in place of the hidden control, so the lead sees the request is waiting. `canRequestReopen` MUST be true only when the
section is `submitted`, the period is `open` or `reopened`, AND no pending reopen
request already exists for that section; it MUST be false in every other case and
MUST refresh after a successful request so the control does not invite a
duplicate. The `archived` state MUST be read from the `Report` archived flag, not
inferred from `periodStatus`. A `published` period is reopened only through the
period-level reopen (Admin → Periods, governed by
`AppSettings.allowReopenAfterPublish`); once it becomes `reopened`, section
reopen requests are allowed again.

Creating the request MUST lock the parent report first inside the same
transaction that rechecks ownership and submitted status and inserts the
request. The shared lifecycle gate MUST admit only the exact draft/open or
published/reopened non-archived tuple; a stale read MUST NOT create a request
after publish or archive commits.

#### Scenario: Open period allows the request

- **WHEN** a lead with a submitted section on an `open` period opens their report
- **THEN** `canRequestReopen` is true, the Request reopen control is shown, and
  `requestReopen` succeeds

#### Scenario: Reopened period allows the request and the section is editable

- **WHEN** a lead has a submitted section on a `reopened` period
- **THEN** `canRequestReopen` is true and, after a head approves, the section
  becomes an editable `draft` (the lead form does not treat a `reopened` period
  as read-only)

#### Scenario: Published period forbids the request

- **WHEN** a lead views a submitted section whose period is `published`
- **THEN** `canRequestReopen` is false, the Request reopen control is hidden, and
  a direct `requestReopen` call is rejected

#### Scenario: Archived period forbids the request

- **WHEN** a lead views a submitted section whose period is `archived`
- **THEN** `canRequestReopen` is false, the Request reopen control is hidden, and
  a direct `requestReopen` call is rejected

#### Scenario: Publish wins request creation

- **WHEN** publish commits after the lead starts `requestReopen` but before its
  transaction locks the parent report
- **THEN** request creation fails closed and no pending row is inserted

#### Scenario: Pending request shows a status, not a control

- **WHEN** a lead's submitted section has a pending reopen request
- **THEN** the lead form shows a "Reopen requested" status and no Request
  reopen control

#### Scenario: An existing pending request hides the control

- **WHEN** a lead's section on an `open` period already has a pending reopen
  request
- **THEN** `canRequestReopen` is false and the Request reopen control is hidden
  until that request is decided

### Requirement: At most one pending reopen request per section

A section MUST NOT hold more than one `pending` reopen request at a time.
`requestReopen` MUST reject a new request for a section that already has a
pending one, with a clear domain error, and the data store MUST enforce the
one-pending-per-section rule independently of the application check.

#### Scenario: Second pending request is rejected

- **WHEN** a lead files a reopen request for a section that already has a pending
  request
- **THEN** the second call is rejected and no second pending row is created

#### Scenario: A new request is allowed after the prior one is decided

- **WHEN** a section's previous request is `approved` or `rejected` and the
  section is submitted again
- **THEN** the lead may file a new reopen request

### Requirement: Deciding a reopen request is race-safe

Deciding a reopen request MUST be atomic against concurrent deciders. The
decision MUST re-check `status = 'pending'` inside the same transaction that
records the decision, so that when two deciders act on the same request only the
first takes effect. Approval MUST additionally require, in the same transaction,
that the target section is still `submitted`; if it is no longer submitted (for
example a head separately revoked it), the request MUST become terminal — it MUST
leave the pending queue (so the pending list and count no longer return it) with
no section change — and the approve/reject funnel metric MUST NOT be skewed by it.
The section flip and the funnel metric increment MUST happen only for the decision
that wins; a losing decision MUST change nothing and MUST report that the request
was already processed.

Before any request or section mutation, the decision transaction MUST lock the
parent report through the same shared lifecycle gate used by section writes. A
publish, archive, deletion, or contradictory lifecycle that wins before this
lock MUST leave the request pending and the section submitted; neither approval
nor rejection may mutate a closed report.

#### Scenario: Concurrent approve and reject

- **WHEN** a head and an admin submit a decision for the same pending request at
  the same time
- **THEN** exactly one decision is recorded, the section is flipped at most once,
  the metric is incremented once, and the losing call reports "already processed"

#### Scenario: Approval of a request whose section was already revoked

- **WHEN** a head approves a pending request whose section is no longer
  `submitted` (it was separately revoked to `draft`)
- **THEN** the section is not flipped again, the approve/reject funnel metric is
  not incremented, the request becomes terminal and drops out of the pending list
  and count, and the call reports the request as stale

#### Scenario: Publish wins request approval

- **WHEN** publish commits after approval starts but before the decision
  transaction locks the parent report
- **THEN** approval fails closed, the request stays pending, and the section
  stays submitted

### Requirement: A period reopen closes the pending section requests it supersedes

The period-level reopen resets every submitted section of the period to `draft`
in its own transaction. In that same transaction it MUST close every `pending`
reopen request of the period's sections as `rejected` (with a review note
stating the period was reopened, no reviewer, and no funnel metric), so the
pending list and count never keep a request whose section has nothing left to
reopen. A refused or rolled-back reopen MUST leave those requests pending.

The system writes its two auto-close review notes
(`REOPEN_AUTO_CLOSE_NOTES` in `packages/shared`: the period reopen above, and a
stale approval of an already-reopened section) from one shared constant, and
`isReopenAutoCloseNote` recognises them by their exact text, so a head's own
note that merely starts with the same words stays a head rejection. The reviewer
cannot be the marker: the period reopen records none, a stale approval records
the deciding head, and legacy genuine decisions can have a NULL reviewer from
user deletions that predate author retention. Future deletion of a referenced
decision author is refused.
No extra status exists. The Reopen Requests tab MUST present a `rejected`
request with an auto-close note using a neutral "Auto-closed" badge, not the red
"Rejected" badge, and MUST label its note "System Note" rather than "Head
Comment".

#### Scenario: Period reopen supersedes a pending section request

- **WHEN** a lead's request is still pending after the period was published and
  the head reopens the period
- **THEN** the section is `draft`, the request is `rejected`, and the pending
  list and count no longer include it

#### Scenario: The tab labels a system-closed request

- **WHEN** the Reopen Requests tab lists a `rejected` request carrying an
  auto-close note
- **THEN** it shows an "Auto-closed" badge and a "System Note" label
- **AND** any other `rejected` request, including a legacy row whose reviewer was
  already deleted, keeps the "Rejected" badge and the "Head Comment" label

#### Scenario: A refused period reopen keeps the request pending

- **WHEN** the period reopen fails because the period changed or is archived
- **THEN** the pending reopen request remains `pending`

### Requirement: A pending reopen response retains its draft owner

The dashboard and admin reopen queues MUST disable Respond controls for other
rows while a response is pending. The active response textarea MUST be disabled
until that response settles. A failed response MUST keep its note and become
editable again.

#### Scenario: Another request cannot replace a pending response draft

- **GIVEN** Alice's response with a note is pending
- **WHEN** Bob's request is also visible
- **THEN** Bob's Respond button is disabled
- **AND** Alice's note cannot be edited before the response settles

#### Scenario: A failed response preserves its note

- **WHEN** Alice's response fails
- **THEN** Alice's note remains visible and editable
- **AND** Respond controls become available again

### Requirement: Reopen-request history is completely and deterministically traversable

The reopen-request list MUST expose cursor pagination that makes every request
within the caller's existing role scope and status filter reachable, including
more than 100 historical rows. Rows MUST be ordered newest first by `createdAt`
and then by request `id`, both descending. A page cursor MUST identify that
compound position without requiring the cursor row to still exist. An exact
last page MUST return no next cursor.

Both the admin Reopen Requests tab and the head dashboard queue MUST offer Load
more when another page exists. A filter or search change MUST reset traversal.
Counts attached to a paged list MUST describe loaded rows rather than claim a
full total. The dashboard's actual pending total MUST continue to come from the
existing pending-count endpoint.

#### Scenario: More than 100 requests remain reachable

- **GIVEN** more than 100 requests match the caller's role scope and status filter
- **WHEN** the caller follows each returned cursor to the terminal page
- **THEN** every matching request is returned exactly once
- **AND** the terminal page has no next cursor

#### Scenario: Equal timestamps have stable order

- **GIVEN** several matching requests share the same creation timestamp
- **WHEN** a page boundary falls between those requests
- **THEN** descending request id breaks the tie
- **AND** following the compound cursor skips or duplicates none of them

#### Scenario: A cursor anchor is deleted

- **GIVEN** a page has returned a next cursor
- **AND** its anchor row is deleted before the next request
- **WHEN** the caller requests that next page
- **THEN** traversal continues below the cursor tuple without looking up the deleted row

### Requirement: Reopen-request search applies to the full scoped history

The reopen-request list MUST apply a trimmed, case-insensitive substring search
on the server before selecting a page. Search MUST match the current rendered
requester name or email, report week label, reason, or review note while
preserving the existing role scope and status filter.

#### Scenario: Search finds a row beyond the former cap

- **GIVEN** a matching request is older than the newest 100 scoped requests
- **WHEN** a head or admin searches for text from any supported rendered field
- **THEN** the matching request is included in the paginated search result

#### Scenario: Search cannot escape role scope or status

- **GIVEN** text matches requests both inside and outside the caller's group or selected status
- **WHEN** the caller searches for that text
- **THEN** only requests admitted by both the existing scope and status filter are returned

### Requirement: Later-page failures preserve reachable reopen-request rows

If a later reopen-request page fails, both UI surfaces MUST retain all rows from
earlier successful pages, identify that the loaded list is partial, and offer a
Retry action for the failed page. Retrying MUST append the recovered page rather
than replacing prior rows.

#### Scenario: Admin later-page request fails and recovers

- **GIVEN** the admin tab has loaded at least one page with another cursor
- **WHEN** Load more fails and the admin retries successfully
- **THEN** the prior rows remain visible throughout
- **AND** the recovered rows append to them

#### Scenario: Dashboard later-page request fails and recovers

- **GIVEN** the head dashboard queue has loaded at least one page with another cursor
- **WHEN** Load more fails and the head retries successfully
- **THEN** the prior rows remain visible throughout
- **AND** the recovered rows append to them

### Requirement: Dashboard response focus stays with the selected row

The dashboard reopen queue MUST move focus from a row's Respond action to that
row's response field when its inline form opens. Cancelling MUST close the form
without submitting a decision and return focus to the same row's remounted
Respond action. Focus handling MUST remain scoped to the selected row when
multiple requests are visible.

#### Scenario: keyboard opens a response form

- **WHEN** a keyboard user focuses a row's Respond action and presses Enter
- **THEN** that row's inline form opens
- **AND** its response field receives focus

#### Scenario: Cancel restores the selected row action

- **WHEN** a keyboard user cancels an open response form while multiple requests are visible
- **THEN** no decision mutation is requested
- **AND** the form closes
- **AND** focus returns to that same row's Respond action

### Requirement: Focus follows a removed reopen row only when it was lost there

When a decision removes the row or form that held keyboard focus, the queue MUST
hand focus to a stable, visible target: the queue container, or on the admin tab
the results region that also holds the empty state once the last request is
decided. Focus MUST move only when it was inside that container before the
removal; a refetch that drops a row while the user is elsewhere on the page MUST
leave focus untouched.

#### Scenario: Deciding the last request lands on the empty state

- **WHEN** an admin or head decides the only listed request from its form
- **THEN** focus lands on the visible results region showing the empty state,
  not on an empty invisible list

#### Scenario: A foreign refetch does not pull focus

- **GIVEN** focus was never inside the queue container
- **WHEN** a background refetch removes a row
- **THEN** focus is unchanged

### Requirement: Reopen decisions refresh dependent live report views

After a reopen decision settles on the dashboard or review/admin surface, the
client MUST refresh the request queue and count together with dependent live
report and review reads. An approved section MUST become visibly editable and
its dashboard row, valid actions, and submission total MUST reflect the server
state without a reload or navigation. A failed decision MUST retain the active
response note while refreshing potentially stale server state.

#### Scenario: Approval refreshes the dashboard report state

- **GIVEN** the dashboard shows a submitted section with a pending reopen request
- **WHEN** the head approves that request
- **THEN** the pending request leaves the queue
- **AND** the section's row and submission total reflect Draft without navigation
- **AND** actions requiring a submitted section are no longer offered for that row

#### Scenario: A failed decision refreshes state without discarding the note

- **GIVEN** a response note is being submitted from either reopen surface
- **WHEN** the decision request fails
- **THEN** the response note remains available for correction or retry
- **AND** dependent live report reads are refreshed alongside the request queue and count

### Requirement: Reopen decision history retains its author

The administrator user-deletion command (`AdminPrismaRepository.removeUser`) MUST return a conflict with deactivation guidance while any live ReopenRequest references that reviewer as its decision author. The author and reviewed request MUST remain unchanged. Deactivation (`AdminPrismaRepository.deactivateUser`) MUST preserve the decision author, review date and note. Reference-free users remain deletable under existing administrator protection.

#### Scenario: An approved or rejected request retains its author

- **GIVEN** an approved or rejected reopen request references a reviewer with no other deletion-blocking references
- **WHEN** an administrator requests hard deletion of that reviewer
- **THEN** deletion fails with a conflict directing the administrator to deactivate instead
- **AND** the user, request, review date and review note remain unchanged

#### Scenario: Deactivation preserves the reviewed request

- **GIVEN** a reopen request retains its decision author
- **WHEN** an administrator deactivates that reviewer
- **THEN** the user becomes inactive
- **AND** the request retains the same author, review date and review note

#### Scenario: A reference-free user can be deleted

- **GIVEN** a user has no reopen-author or other deletion-blocking references and existing administrator protection allows deletion
- **WHEN** an administrator requests hard deletion
- **THEN** only that user is deleted and unrelated decision history remains unchanged

### Requirement: Reopen author references remain valid during competing writes

Competing reopen-author reference writes and user deletion MUST NOT commit a live orphan or silently clear its author. A reference that commits first MUST retain its author and history. If deletion commits first, a later reference write MUST fail without creating an orphan. Existing reviewer-history protection remains unchanged.

#### Scenario: A reference commits before deletion

- **WHEN** a reopen-author reference is inserted and user deletion waits for that competing transaction
- **THEN** reference commit causes deletion to fail
- **AND** the reviewed request and user remain intact

#### Scenario: Deletion commits before a reference

- **WHEN** deletion locks a reference-free user and a competing reopen-author reference write waits
- **THEN** deletion commit causes the reference write to fail
- **AND** the deleted user remains absent and no orphan request is created

### Requirement: Existing absent reopen authors remain historical data

Existing ReopenRequest rows whose decision author is NULL MUST remain unchanged during the retention migration. The migration MUST NOT infer, reconstruct or assign an author. Their status, review date and note remain unchanged; the existing auto-close note classification remains authoritative.

#### Scenario: A legacy decision has no author

- **GIVEN** an existing approved or rejected request has a NULL decision author
- **WHEN** the author-retention migration is applied
- **THEN** its author remains NULL and its status, review date and review note are unchanged
- **AND** a human decision note still uses the existing rejection or approval presentation rather than a system auto-close label
