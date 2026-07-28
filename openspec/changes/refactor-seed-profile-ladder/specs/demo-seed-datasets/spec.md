## MODIFIED Requirements

### Requirement: Three selectable demo-seed tiers

The repository MUST replace the `small`, `middle`, and `huge` public tier
contract with exactly four explicit profiles selected through one public entry
point: `minimal`, `demo`, `full`, and `stress`. The old tier and `fresh:*`
commands MAY be removed without compatibility aliases after all repository
callers migrate.

#### Scenario: A developer selects a profile

- **WHEN** `pnpm db:seed:profile demo` runs against a database accepted by the
  destructive guard
- **THEN** only the deterministic demo profile is written
- **AND** its manifest validator and smoke journey can address the same stable
  identities

#### Scenario: A profile is omitted or unknown

- **WHEN** the public selector receives no profile or a name outside the four
  canonical values
- **THEN** it exits nonzero before wiping or writing data

### Requirement: Demo seed is deterministic

Every profile MUST use fixed identifiers and fixed textual content. Reseeding
the same profile MUST reproduce its identifiers, content, capability manifest,
and bounded row counts. Period dates MAY be computed relative to the run week
so the active period covers today.

#### Scenario: A profile is reseeded

- **WHEN** the same profile is applied twice to a disposable database
- **THEN** its stable identifiers, text, capabilities, and bounded counts match
- **AND** only the explicitly permitted week-relative date fields may differ

## ADDED Requirements

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

Hard reset, migration seed, visual regression, UAT, developer reseed, and e2e
setup MUST select a canonical profile explicitly. No caller may depend on an
implicit `seed-simple.ts` default or an undocumented command-to-dataset mapping.

#### Scenario: Hard reset completes

- **WHEN** the repository hard-reset command is invoked with a canonical profile
- **THEN** it preserves the destructive guard, resets the accepted disposable
  target, writes that profile, and runs its validator

### Requirement: MVP data cutovers preserve safety, not old rows

Profile and schema changes MAY discard existing non-production MVP rows and MAY
use breaking reset-based cutovers. They MUST preserve the destructive database
guard and MUST NOT treat an unnamed external database as an execution target.

#### Scenario: A profile requires a reshaped schema

- **WHEN** the new architecture cannot read prior disposable rows
- **THEN** the repository migration/reset path may rebuild the database
- **AND** all four profile writers and proofs are adapted before completion
