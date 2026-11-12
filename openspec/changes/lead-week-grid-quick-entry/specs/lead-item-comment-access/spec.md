## Purpose

Make authorized record comments understandable and reachable from the Lead Overview.

## ADDED Requirements

### Requirement: The item discussion has a visible, authorized result

A record’s discussion MUST open as a modal `Discussion` Sheet with its authorized comments, an honest empty state and a reply composer for the Lead’s own eligible item. A row MUST show a discussion icon, named `Discussion: <title>, N comments`, only when the record has comments; otherwise the discussion MUST be reached through `Discussion (N)` in the in-place editor. The server MUST enforce ownership, role and lifecycle rules.

#### Scenario: No comments exist

- **WHEN** a Lead opens `Discussion (0)` in the in-place editor of their own editable item without comments
- **THEN** the `Discussion` Sheet shows an honest empty state
- **AND** it does not claim a message was sent or add a comment without an authorized submission
- **AND** the record's row shows no discussion icon

#### Scenario: The icon appears only with comments

- **WHEN** a record has one or more authorized comments
- **THEN** its row shows the discussion icon with the count, visible without hover, with a 44 px target on touch
- **AND** a record with no comments shows no icon, and the icon appears once the first comment is confirmed

#### Scenario: A record has reviewer comments

- **WHEN** a Lead activates the discussion icon on their own item with authorized reviewer comments
- **THEN** the `Discussion` Sheet exposes those comments for that record and does not reveal another author's private comments

#### Scenario: A Lead replies to their own item

- **GIVEN** an eligible item belonging to the Lead's own report section
- **WHEN** the Lead submits a valid reply in its discussion
- **THEN** the server records the reply on that exact item under the authenticated author
- **AND** the discussion shows the confirmed reply after persistence

#### Scenario: A reply is rejected or fails

- **WHEN** a reply is invalid, unauthorized or cannot be saved
- **THEN** the entered text remains available with an actionable error
- **AND** the interface does not claim it was sent

#### Scenario: Another author's item or frozen history

- **WHEN** a Lead attempts to reply to another author's item or an ineligible live target
- **THEN** the server rejects the write
- **AND** the UI never submits from a historical snapshot and the server never modifies stored snapshots through this command
- **AND** a client presentation-source flag is not treated as server-verifiable provenance for an otherwise eligible live item after reopening
- **AND** existing authorized reviewer actions remain governed by their established role and lifecycle rules

#### Scenario: Item saves preserve the discussion

- **WHEN** a report save recreates the physical item row while preserving its lineage
- **THEN** existing discussion messages retain their identity, authors and timestamps on that lineage
- **AND** live messages remain in chronological order without duplicate or resurrected entries

#### Scenario: A reply response is lost

- **WHEN** the reply might have been persisted but its response is lost
- **THEN** the text remains available and the result is presented as uncertain
- **AND** the Lead can check the discussion before a manual resend without an automatic duplicate retry

### Requirement: Live discussion reads have a narrow authoritative source

The system SHALL expose one uncached own-Lead discussion query selected by report, section and stable item lineage through the canonical Lead procedure. A fresh coherent primary read SHALL check the active database Lead, exact own report section, complete valid editable report lifecycle, unique item and ordered comments in one snapshot.

#### Scenario: A target is denied

- **WHEN** the target is missing, foreign, deleted, ambiguous, mismatched or lifecycle-ineligible, or the database actor is inactive or no longer a Lead
- **THEN** the query returns the same unavailable result without target details or private comments
- **AND** canonical middleware retains its authentication and wrong-role errors
- **AND** transient storage or transport failure is not converted to an empty or unavailable success

#### Scenario: Eligible live items are not limited by editor actions

- **WHEN** an own item is submitted, completed or resolved within an eligible live report, including an eligible older or future report
- **THEN** discussion eligibility follows the report lifecycle and ownership rather than edit controls, global-current status or reviewer designation
- **AND** established reviewer permissions remain unchanged

#### Scenario: Reads overlap a canonical save or deletion

- **WHEN** a discussion read overlaps a save that recreates physical rows or a deletion
- **THEN** target and comments belong to one coherent old or new snapshot, not a mixed graph
- **AND** a read begun after a confirmed commit observes that commit or a later legitimate change
- **AND** messages are ordered by creation time and ID without content-based deduplication

### Requirement: Discussion reads are read-only and uncached

The read SHALL NOT invoke a write-fencing helper, create a section, read published JSON, return a whole section or modify Report rows. Private responses SHALL prohibit caching at the server boundary as well as the client.

#### Scenario: A served read performs no writes and caches nothing

- **WHEN** an eligible own-Lead discussion read is served
- **THEN** it invokes no write-fencing helper, creates no section, reads no published JSON and returns no whole section
- **AND** it modifies no Report row
- **AND** the private response is not cached at the server boundary or the client

### Requirement: Presentation origin and exact saved identity govern discussion routing

The UI SHALL distinguish own live, published snapshot, submitted predecessor, authorized read-only live, foreign/redacted and unavailable sources where the source is selected. Historical comments SHALL come from that actual authorized source, never a dirty editor fallback. A source discriminator is presentation provenance, not authorization. The server SHALL independently authorize every live read and write.

#### Scenario: Current and its derived Next share a discussion

- **WHEN** a persisted Current item also has a derived Next projection
- **THEN** both projections use one discussion keyed by session, user, report, section and stable lineage
- **AND** a derived `Next step` line shows no icon of its own and its editor’s `Discussion (N)` opens the source record’s discussion
- **AND** explicit Next has its own selected-section discussion
- **AND** Previous never redirects its identity to Current
- **AND** historical Current and derived Next show the same authorized source comments, or the derived historical control is deliberately omitted rather than claiming an empty discussion

#### Scenario: Dirty content survives a source switch without contaminating history

- **GIVEN** a dirty editor contains message A and the authorized frozen source contains only B
- **WHEN** the presentation becomes frozen
- **THEN** history shows B rather than A without replacing the dirty editor
- **AND** archived read-only live data is not mislabeled as a published snapshot
- **AND** reopening requires a new live activation and a fresh discussion read

#### Scenario: A new item's reply cannot migrate by content matching

- **WHEN** a local item has no proven persisted identity
- **THEN** the UI withholds Send and explains why without forcing a whole-section save
- **AND** automatic transfer of a reply draft requires exactly one captured client ID and preallocated stable ID in the submitted payload, exactly one corresponding stable ID and claimed server ID in the persisted response, and matching report section, generation, receipt scope and increasing consumed receipt sequence
- **AND** content, occurrence order and a unique derived itemIdentities pair alone are insufficient proof
- **AND** absent or ambiguous proof leaves the draft explicitly available to copy without guessing a target

### Requirement: One discussion owner separates read state from delivery outcome

The page SHALL own each complete live message list separately from editor data, with an active projection owner set, read invalidation ticket, draft edit sequence and independent mutation outcome. A successful read SHALL replace the complete list, including deletions, without resolving uncertain delivery. Discussion activity SHALL NOT save, refetch, reseed, invalidate or remount the whole editor, or use section version as comment freshness.

#### Scenario: Aliases and receipts do not multiply work

- **WHEN** both aliases are open and one closes during a read or send
- **THEN** the remaining alias remains usable and shares the one pending attempt
- **AND** a pending attempt remains owned even when both aliases are hidden
- **AND** repeated save invalidations are coalesced, refreshing only open discussions or just-confirmed sends; inactive entries refresh on their next opening

#### Scenario: A confirmed reply is subsequently deleted

- **WHEN** a read started after acknowledgement returns a list without the confirmed reply
- **THEN** that list replaces the complete live list without an indefinite acknowledgement overlay
- **AND** earlier reads, old save responses and equal-version section deliveries cannot restore the removed reply
- **AND** a failed post-acknowledgement refresh is labeled as sent with refresh failure, not uncertain delivery

#### Scenario: Typing continues while a reply is pending

- **WHEN** reply A is pending and the user types B or edits away from and back to A
- **THEN** acknowledgement does not clear that subsequently edited draft
- **AND** textarea, caret and unrelated dirty fields remain intact
- **AND** multiple submit actions across aliases dispatch only one mutation while pending

#### Scenario: An old physical address is rejected

- **WHEN** canonical save has replaced the physical item ID before the reply's initial server lookup
- **THEN** a known target rejection preserves text and performs only a fresh scoped read
- **AND** sending to the newly resolved physical ID requires a new explicit Send action, never automatic mutation retry

#### Scenario: Uncertain delivery survives checking and navigation

- **WHEN** an acknowledgement is lost and subsequent reads are empty or contain matching-looking text
- **THEN** delivery remains uncertain and no content heuristic identifies the attempt
- **AND** a possible resend requires a user-directed check followed by an explicit duplicate-risk action
- **AND** discarding text does not certify that the unresolved attempt did not commit
- **AND** late acknowledgements settle only their original attempt and do not append into a later activation or clear a later draft

### Requirement: Access loss and session teardown hide private discussion state

Known authorization loss or identity change SHALL immediately hide private messages, counts and orphan draft text and invalidate the activation, independently of request completion. Logout and user or session replacement SHALL dispose private stores. Ordinary transient network failure MAY retain explicitly stale content only while its scope remains authorized.

#### Scenario: Middleware denies a previously authorized discussion

- **WHEN** a role or author switch, FORBIDDEN, UNAUTHORIZED or login redirect occurs after an own discussion read
- **THEN** the new surface exposes neither the old messages nor draft text, even if a request promise never settles
- **AND** a same-user login under a new session epoch cannot reuse the previous store

#### Scenario: A session transition cancels queued sending

- **WHEN** Send is invoked during a session transition or its queued operation is disposed before transmission
- **THEN** the adapter blocks the invocation or propagates its AbortSignal to the mutation transport so it is not transmitted after release
- **AND** an abort after dispatch is not evidence of rollback and never permits automatic resend
- **AND** collapsing a card alone does not abort a send

### Requirement: Normal discussion interaction is direct and accessible

Opening an eligible persisted item's discussion SHALL resolve and read automatically; ordinary open, type and Send SHALL require no additional Save, Refresh or confirmation action. A reachable read-only refresh control SHALL exist on healthy live discussions. Unsent, pending and uncertain state SHALL survive SPA report navigation through isolated same-session retention or an explicit existing leave decision, without durable or cross-user caching.

#### Scenario: A card disappears while it owns an unsent reply

- **WHEN** the item is removed or filtered out
- **THEN** its reply remains reachable in an authorized copy/discard notice outside the card
- **AND** a foreign or redacted surface never displays that private notice

#### Scenario: Keyboard and empty-discussion access

- **WHEN** a user opens a zero-message discussion through `Discussion (N)` in the editor, or a comments-only eligible item through its icon
- **THEN** the visible trigger opens it and deliberately focuses the composer or read-only heading
- **AND** each projection has unique control IDs, Close or Escape returns focus to its trigger or a reachable fallback, and composition Escape and textarea newlines remain intact
- **AND** loading is not presented as an honest empty result and network completion does not steal focus

#### Scenario: The editor stays open under the Sheet

- **WHEN** the Lead opens `Discussion (N)` from an in-place editor holding an unsaved draft
- **THEN** the draft stays intact under the Sheet, and closing the Sheet returns focus to that editor control

This item-only increment does not complete risk or decision discussions, ordinary editor 409 recovery, realtime revocation, exactly-once delivery or persistence across browser termination.

### Requirement: The discussion is a modal Sheet at every width

The discussion of a record MUST open as a modal `Discussion` Sheet at every width. While it is open the page below MUST be inert, Tab MUST cycle inside the Sheet, and Escape or its close control MUST return focus to the trigger that opened it. Its reply draft MUST survive closing and reopening within the same session until it is sent or cleared.

#### Scenario: The Sheet isolates the page

- **WHEN** a Lead opens the discussion of a record
- **THEN** the page behind the Sheet is inert and Tab cycles only among the Sheet's controls
- **AND** the same modal behaviour applies at phone and desktop widths

#### Scenario: Escape returns focus to the trigger

- **WHEN** the Lead presses Escape or activates the close control of the Discussion Sheet
- **THEN** the Sheet closes and focus returns to the discussion control that opened it

#### Scenario: A typed draft is kept

- **WHEN** the Lead has typed reply text and closes the Sheet
- **THEN** the text is kept and returns when the Sheet is reopened for the same record, until it is sent or cleared

#### Scenario: An unsaved item cannot receive a reply

- **WHEN** the record is not yet saved
- **THEN** Send is disabled and the Sheet states `This item is not saved yet. You can send a reply once it is.`

#### Scenario: Ctrl+Enter sends a reply

- **WHEN** the Lead presses Ctrl+Enter in the reply field of a saved record that the Lead may answer
- **THEN** the reply is sent through the same authorized path as the Send control
