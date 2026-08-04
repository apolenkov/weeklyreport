## ADDED Requirements

### Requirement: Restore confirmation identifies the complete resolved target

The production restore entrypoint MUST canonicalize and display environment identity, host, port, and database, and MUST require an exact confirmation token for that complete target before invoking any destructive `pg_restore` action.

#### Scenario: Database name matches but host differs

- **WHEN** the operator confirms the expected database name while `PGHOST` or `PGPORT` resolves to another cluster
- **THEN** restore refuses before invoking `pg_restore`

#### Scenario: Complete non-production target matches

- **WHEN** the readable archive is valid and the exact non-production environment, host, port, and database token matches
- **THEN** restore may run once in a single transaction

#### Scenario: Production target lacks destructive consent

- **WHEN** the exact production target token matches but the production-destructive consent is absent or malformed
- **THEN** restore refuses before invoking `pg_restore`

#### Scenario: Production target has complete consent

- **WHEN** archive validation, exact target confirmation, and production-destructive consent all match the same resolved target
- **THEN** restore may invoke the single-transaction command and logs the canonical target without credentials
