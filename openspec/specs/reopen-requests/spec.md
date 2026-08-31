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
false) on the lead-form read so the lead's Request Reopen control is hidden
exactly when the server would reject the call — the web client MUST NOT
reconstruct the policy itself. `canRequestReopen` MUST be true only when the
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
- **THEN** `canRequestReopen` is true, the Request Reopen control is shown, and
  `requestReopen` succeeds

#### Scenario: Reopened period allows the request and the section is editable

- **WHEN** a lead has a submitted section on a `reopened` period
- **THEN** `canRequestReopen` is true and, after a head approves, the section
  becomes an editable `draft` (the lead form does not treat a `reopened` period
  as read-only)

#### Scenario: Published period forbids the request

- **WHEN** a lead views a submitted section whose period is `published`
- **THEN** `canRequestReopen` is false, the Request Reopen control is hidden, and
  a direct `requestReopen` call is rejected

#### Scenario: Archived period forbids the request

- **WHEN** a lead views a submitted section whose period is `archived`
- **THEN** `canRequestReopen` is false, the Request Reopen control is hidden, and
  a direct `requestReopen` call is rejected

#### Scenario: Publish wins request creation

- **WHEN** publish commits after the lead starts `requestReopen` but before its
  transaction locks the parent report
- **THEN** request creation fails closed and no pending row is inserted

#### Scenario: An existing pending request hides the control

- **WHEN** a lead's section on an `open` period already has a pending reopen
  request
- **THEN** `canRequestReopen` is false and the Request Reopen control is hidden
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
