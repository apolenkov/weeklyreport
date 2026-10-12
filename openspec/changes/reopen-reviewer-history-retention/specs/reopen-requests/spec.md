## ADDED Requirements

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

## MODIFIED Requirements

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
