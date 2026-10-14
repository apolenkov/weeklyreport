## ADDED Requirements

### Requirement: Head Reopen Rechecks the Active Reopen Guard Atomically

The period reopen repository MUST serialize every reopen on the shared status-graph transaction barrier before reminder-policy or report locks. A Head reopen MUST recheck absence of non-archived reopened reports in that transaction before the lifecycle CAS. Rejection MUST leave the target report and its child rows unchanged, including when no reminder policies exist.

#### Scenario: Admin recovery commits after the Head prechecks

- **GIVEN** a Head request passed early gates for the newest published report
- **WHEN** Admin recovery reopens another report before the Head write transaction
- **THEN** the Head transaction rejects with a scope error
- **AND** the Head report, sections, pending reopen requests, and reminder rules remain unchanged.

#### Scenario: Two legal Head targets are admitted around a publication

- **GIVEN** a Head reopen passed early gates for the newest published report
- **AND** a newer report is published while that reopen is paused
- **WHEN** another Head reopen passes early gates for the newly published report and both reopens continue concurrently with no reminder policies
- **THEN** exactly one reopen succeeds and the other fails closed
- **AND** exactly one non-archived reopened report is committed.

### Requirement: Reopen Policy Comes from the Server Session

The period reopen repository MUST require an explicit policy derived by the service from the authenticated server session. Head requires the transactional active-reopen guard. Admin recovery MUST use the same transaction barrier while remaining exempt from that guard; multiple Admin-reopened reports remain legal.

#### Scenario: Server derives the Head guard

- **WHEN** a Head calls the public period reopen service
- **THEN** the repository receives the required single-reopen policy from the server session.

#### Scenario: Admin recovery remains exempt

- **GIVEN** a non-archived reopened report already exists
- **WHEN** an Admin reopens a different eligible published report
- **THEN** recovery succeeds through the same transaction barrier and existing lifecycle CAS
- **AND** both reports remain reopened.
