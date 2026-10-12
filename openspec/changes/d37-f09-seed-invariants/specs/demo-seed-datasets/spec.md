## ADDED Requirements

### Requirement: Seed assignment upsert preserves the first owner

The public advanced `seedStageAssignments` writer MUST retain an existing natural-key assignment's identity and owner, including one inserted after its absent read. Its returned effective ownership MUST reflect persisted rows; it MUST NOT add grants or reassign a pair to force fixture validity.

#### Scenario: Another owner wins the insertion window

- **WHEN** a valid assignment is inserted after the seed reads a missing stage/product pair
- **THEN** the seed upsert preserves that assignment and returns its actual ownership

### Requirement: Advanced status restoration respects effective owners

The public advanced seedActiveSections writer MUST emit only its existing planned stage slots owned by each section author. It MUST reject invalid or missing explicit ownership before status cleanup. It MAY remove only an unowned generated slot matching its exact id, stage, section and product, preserving every other row. Reported advanced stage-status counts MUST count actual emitted rows.

#### Scenario: Simple ownership is retained in a composed profile

- **WHEN** simple assignments and statuses precede the advanced writer
- **THEN** every emitted advanced status belongs to its section author
- **AND** existing owned statuses survive the declared section identity rekey

#### Scenario: A standalone restore finds stale generated statuses

- **WHEN** a planned generated slot is no longer owned
- **THEN** only its exact generated id/stage/section/product tuple is removed
- **AND** valid generated, nongenerated and unrelated rows remain

### Requirement: Profile validation proves every required identity

The public validateSeedProfile operation MUST reject a missing profile-owned user, project or report id after its scoped reads and before volume or journey checks. The diagnostic MUST name only the profile, entity dimension and missing ids. Existing volume bounds, capability guards and identity lists MUST remain unchanged; unrelated rows MUST NOT replace required identities.

#### Scenario: Missing Head still satisfies user volume bounds

- **WHEN** the minimal profile lacks its required Head while four scoped users remain
- **THEN** validation rejects that missing user id rather than accepting the count

#### Scenario: A required product or report is absent

- **WHEN** a scoped product or report id is not returned
- **THEN** the missing dimension and id are reported before count-bound diagnostics

### Requirement: Profile children share one run reference

The public runSeedProfile operation MUST resolve the existing validated seedReferenceDate once after its guard and forward that normalized ISO instant to every writer, AI overlay and validator child without mutating the parent environment. Invalid explicit input MUST fail before the first child. This requirement does not introduce default UTC-week completion refusal or automatic retry.

#### Scenario: A default run spans UTC Monday

- **WHEN** different child phases start on different sides of UTC Monday
- **THEN** every child receives the same run reference instant

#### Scenario: The caller supplies an explicit offset instant

- **WHEN** an accepted ISO instant contains a timezone offset
- **THEN** children receive its normalized equal UTC instant and the parent raw value is unchanged

### Requirement: Seed CLI cleanup preserves operation failures

The seed-profile-validate, canonical seed.ts and seed-simple entrypoints MUST independently attempt client disconnect and pool end after construction or operation failure. They MUST preserve a sole primary throwable exactly, including undefined; if cleanup also fails they MUST report an ordered AggregateError with primary first and cause. Cleanup-only failure MUST remain nonzero. Validation and canonical seed success summaries MUST follow successful cleanup; Simple live-client phase diagnostics remain before teardown.

#### Scenario: Disconnect fails after an operation failure

- **WHEN** the operation and disconnect both fail
- **THEN** pool end is still attempted and both failures remain inspectable in order

#### Scenario: Only cleanup fails

- **WHEN** the operation succeeds but cleanup fails
- **THEN** the CLI reports nonzero and validation emits no validated success summary

### Requirement: Local Prisma commands retain failure diagnostics

The existing guarded bootstrap, migration and hard-reset commands MUST stop on a failed child. Their public errors MUST retain the operation, native exit status, signal and spawn error when provided; a spawn error MUST remain inspectable as cause. A null exit status MUST NOT imply OOM or successful execution. No retry or rollback policy is introduced.

#### Scenario: A child cannot start

- **WHEN** the OS returns ENOENT at the spawn boundary
- **THEN** the public operation rejects with its step context and the original spawn error as cause
- **AND** later steps do not run

#### Scenario: A child is terminated by a signal

- **WHEN** the OS returns a null status and SIGTERM
- **THEN** migration diagnostics identify SIGTERM without inventing an exit code

### Requirement: Public-schema reset emits public table identities

The hard-reset producer MUST qualify discovered public table identities in its generated TRUNCATE command, preserving PostgreSQL identifier quoting. This clarification does not expand table discovery or authorize wiping another schema.

#### Scenario: A discovered public table has a quoted name

- **WHEN** the public-schema discovery result contains a table name with an embedded quote
- **THEN** the generated command qualifies it with the public schema and doubles the embedded quote

### Requirement: Disposable database creation preserves client failures

The existing createE2eDatabase public operation MUST attempt client end after a connect or query failure. It MUST preserve a sole primary throwable exactly; a cleanup failure MUST remain observable as an ordered AggregateError, with primary first and cause when both fail. Guard timing and the existing presence check MUST remain unchanged; this correction does not treat duplicate-database races as success or change SQLSTATE handling.

#### Scenario: The maintenance client cannot connect

- **WHEN** connect rejects
- **THEN** client end is attempted and no query is issued
- **AND** the original throwable remains inspectable

#### Scenario: The target already exists

- **WHEN** the existing presence query returns the target database
- **THEN** no CREATE command is issued and client end is attempted
