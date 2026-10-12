## ADDED Requirements

### Requirement: Tester-stand bootstrap fails closed

The tester-kit `start.sh` MUST NOT treat a failed first-start `User` count
query as an empty dataset: probe stderr MUST stay visible, a non-zero probe
MUST abort the run without invoking the guarded reset, and the reset MUST run
only after a successful count of `0`. When `--registry` pull credentials are
configured, the registry password MUST NOT appear on any child process command
line; the registry configuration MUST pass through a private file under the
700 `STATE_DIR` and be removed afterwards.

#### Scenario: First-start user probe fails

- **WHEN** the `User` count query exits non-zero (unreachable postgres, auth failure, missing table)
- **THEN** `start.sh` exits non-zero without running the reset
- **AND** the probe's stderr remains visible to the operator

#### Scenario: Verified empty dataset resets

- **WHEN** the `User` count query succeeds with `0`
- **THEN** `start.sh` invokes the guarded reset once and continues

#### Scenario: Registry credentials configured

- **WHEN** `start.sh --registry` runs with `REGISTRY_USER` and `REGISTRY_PASSWORD`
- **THEN** the pull-secret manifest is applied without the password appearing on any child argv
- **AND** the private registry file is removed afterwards

#### Scenario: Credentials contain JSON control characters

- **WHEN** `REGISTRY_USER` or `REGISTRY_PASSWORD` contain characters that cannot appear literally inside a JSON string
- **THEN** the private registry file still parses as a dockerconfig document carrying the exact credentials
- **AND** the credentials reach the serializer only through its inherited environment, never its argv

### Requirement: Port-forward helpers verify process identity

The `env.sh` port-forward helpers MUST NOT treat a bare PID as proof of an
owned forward. `pf_start` MUST record the spawned child's PID together with
its start time and forward target, `pf_stop` MUST signal the recorded PID
only while the live process still matches that recorded identity, and a
missing, old-format, dead or mismatched record MUST fail closed without
any signal being sent and without being accepted as a running forward.

#### Scenario: Recorded forward is stopped

- **WHEN** the pidfile's recorded PID, start time and forward target still match the live process
- **THEN** `pf_stop` signals that process and removes the pidfile

#### Scenario: Recorded PID was reused

- **WHEN** the pidfile PID is alive but the live process fails the recorded identity check
- **THEN** `pf_stop` leaves that process running and does not signal it

#### Scenario: Missing or partial identity record

- **WHEN** the pidfile is absent, written in the old PID-only format or missing identity fields
- **THEN** `pf_stop` signals nothing and `pf_start` does not treat the record as a running forward
