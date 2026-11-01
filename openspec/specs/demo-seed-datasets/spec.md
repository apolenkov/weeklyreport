# demo-seed-datasets Specification

## Purpose

Provide four explicit deterministic seed profiles as a monotonic capability ladder with stable identities, bounded data volume, and executable product proof.

## Requirements

### Requirement: Four explicit seed profiles

The repository MUST expose exactly four profiles through one public selector:
`minimal`, `demo`, `full`, and `stress`.

#### Scenario: A developer selects a profile

- **WHEN** `pnpm db:seed:profile demo` runs against a database accepted by the
  destructive guard
- **THEN** only the deterministic demo profile is written
- **AND** its validator addresses the same stable identities as its manifest

#### Scenario: A profile is omitted or unknown

- **WHEN** the selector receives no profile or a name outside the four
  canonical values
- **THEN** it exits nonzero before wiping or writing data

### Requirement: Seed profiles form a monotonic capability ladder

The profile manifests MUST prove that `minimal` capabilities are a strict subset
of `demo`, `demo` capabilities are a strict subset of `full`, and `stress`
contains every `full` capability while increasing deterministic data volume.
A richer profile MUST NOT remove an already-proved capability.

#### Scenario: Stress is generated

- **WHEN** the stress profile passes validation
- **THEN** every full-profile capability is present
- **AND** the configured volume dimensions exceed the full profile's bounded
  counts

### Requirement: Demo preserves the curated product walkthrough

The `demo` profile MUST provide the curated walkthrough: multiple roles,
green/yellow/red product health, multi-stage
items, split and vacant stage ownership, foreign co-owner content in current
and next week buckets, draft/submitted contrast, a published period, active
reminder dispatch, and a blocked item that derives Needs Attention. These rows
MUST use stable identities and MUST remain non-empty in the public report and
admin journeys.

#### Scenario: A presenter opens the demo profile

- **WHEN** the demo profile is seeded and the primary lead opens the report
- **THEN** Mine and Everyone expose different ownership-scoped content
- **AND** the walkthrough contains green, yellow, and red product health
- **AND** current and published periods, draft and submitted leads, and an
  active reminder path are addressable

#### Scenario: Demo enrichment preserves product health

- **WHEN** foreign current-week and next-week content is validated
- **THEN** the green, yellow, and red product mapping remains unchanged
- **AND** no unrelated leftover row can satisfy the manifest

### Requirement: Demo reopen example is actionable

The `demo`, `full`, and `stress` profiles MUST contain exactly one pending
reopen request on a submitted section of the current, non-archived open report.
The seeded Admin → Reopen example MUST therefore be approvable or rejectable;
it MUST NOT point to a published or archived report merely to populate the
queue.

#### Scenario: An administrator opens the seeded reopen queue

- **WHEN** a supported profile is seeded and an administrator opens Admin → Reopen
- **THEN** the pending example belongs to a submitted section on the current open
  report
- **AND** either decision can be completed without a lifecycle error

### Requirement: Every seed profile is deterministic

Every profile MUST use fixed identifiers and textual content. Reseeding the
same profile MUST reproduce its identifiers, content, capability manifest, and
bounded row counts. Period dates MAY be computed relative to the run week so the
active period covers today.

#### Scenario: A profile is reseeded

- **WHEN** the same profile is applied twice to a disposable database
- **THEN** its stable identifiers, text, capabilities, and bounded counts match
- **AND** only explicitly permitted week-relative date fields may differ

### Requirement: Every profile has executable product proof

Each profile MUST have a checked-in capability manifest, bounded row-count
invariants, stable identifiers, post-seed validation scoped to its own rows, and
at least one end-to-end smoke journey appropriate to its purpose.

#### Scenario: Leftover rows contain a missing capability

- **WHEN** the selected profile did not create a required row but another
  dataset left one in the database
- **THEN** profile validation still fails
- **AND** the unrelated row cannot satisfy the scoped manifest

### Requirement: Repository seed consumers select profiles explicitly

Development reset and migration seed MUST select a canonical profile
explicitly. No caller may depend on an implicit default or an undocumented
command-to-dataset mapping.

#### Scenario: Hard reset completes

- **WHEN** the hard-reset command is invoked with a canonical profile
- **THEN** it preserves the destructive guard, resets the accepted disposable
  target, writes that profile, and runs its validator

### Requirement: Profile cutovers preserve safety

Profile and schema changes MAY discard existing non-production MVP rows and MAY
use breaking reset-based cutovers. They MUST preserve the destructive database
guard and MUST NOT treat an unnamed external database as an execution target.

#### Scenario: A profile schema differs from disposable rows

- **WHEN** the selected profile cannot read existing disposable rows after a
  schema change
- **THEN** the migration/reset path may rebuild the database
- **AND** all four profile writers and proofs are adapted before completion

### Requirement: Seeded product groups match effective user groups

The canonical `demo`, `full`, and `stress` seed profiles MUST assign every
seeded product's explicit reporting-group edge to the effective reporting group
of its seeded lead after all profile-specific user-group assignments are
applied. Profile validation MUST fail when a product edge and its lead's
effective group disagree. The lead Section Preview route MUST therefore render
the populated draft products of every seeded lead whose edit form is populated.

#### Scenario: Finance lead opens a populated draft preview

- **WHEN** the `full` profile is seeded and the Finance lead opens `/lead/report/:reportId/preview` for the active report
- **THEN** the preview shows that lead's populated draft products and records
- **AND** it does not show the no-submissions empty state

#### Scenario: Product-group ownership drifts during seed composition

- **WHEN** a seeded product points to a reporting group different from its seeded lead's effective reporting group
- **THEN** profile validation exits nonzero
- **AND** the profile is not accepted as executable product proof

### Requirement: Demo authored records respect seeded stage ownership

Every active authored demo item, risk and decision MUST use stages assigned to
its author on its parent product. This MUST include cross-author overlay rows.
Stage-status fixtures MUST reference an assignment owned by their section author.
The fixture writer MUST NOT grant additional assignments to make invalid rows
pass the product guard.

#### Scenario: A lead saves a populated demo draft

- **WHEN** a lead edits and saves their draft after the demo profile is seeded
- **THEN** the complete authored payload passes stage-ownership validation
- **AND** unchanged base and overlay records do not block the save
- **AND** foreign co-owner records remain separately authored read-only content

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
