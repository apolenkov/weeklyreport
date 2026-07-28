## REMOVED Requirements

### Requirement: Three selectable demo-seed tiers

**Reason**: Size names did not form a capability ladder and exposed overlapping
entry points.

**Migration**: Use the added four-profile selector contract.

### Requirement: Small tier is minimal and stage-realistic

**Reason**: `minimal` now means the smallest boot/auth/write graph; the richer
stage-realistic walkthrough belongs to `demo`.

**Migration**: The stage and ownership scenarios move to the added demo
walkthrough requirement.

### Requirement: Demo periods support the head and switching flows

**Reason**: Period switching is one capability of the named `demo` profile,
rather than a property of an implicit small tier.

**Migration**: The scenario moves to the added demo walkthrough requirement.

### Requirement: A blocked item demonstrates Needs Attention

**Reason**: The blocked-item example remains required, but is now declared by
the `demo` capability manifest.

**Migration**: The scenario moves to the added demo walkthrough requirement.

### Requirement: Demo seed is deterministic

**Reason**: Determinism now applies to every named profile, including bounded
counts and capability manifests.

**Migration**: Use the added all-profile determinism requirement.

### Requirement: The small tier seeds cross-author co-ownership and foreign content

**Reason**: Cross-author content remains a `demo` walkthrough capability; the
public small tier no longer exists.

**Migration**: The scenario moves to the added demo walkthrough requirement.

### Requirement: The small tier shows at least one fully-green product

**Reason**: The three-state health showcase remains a `demo` capability; the
public small tier no longer exists.

**Migration**: The scenario moves to the added demo walkthrough requirement.

### Requirement: Co-owner foreign content spans both week buckets across multiple shared sections

**Reason**: Week-bucket foreign content remains a `demo` capability and is
validated through the named profile.

**Migration**: The scenario moves to the added demo walkthrough requirement.

### Requirement: The small tier seeds at least one submitted lead

**Reason**: Submitted-versus-draft contrast remains a `demo` capability; the
public small tier no longer exists.

**Migration**: The scenario moves to the added demo walkthrough requirement.

### Requirement: The small tier seeds one active reminder rule for the active period

**Reason**: Reminder dispatch remains a `demo` capability; the public small tier
no longer exists.

**Migration**: The scenario moves to the added demo walkthrough requirement.

## ADDED Requirements

### Requirement: Four explicit seed profiles

The repository MUST expose exactly four profiles through one public selector:
`minimal`, `demo`, `full`, and `stress`. Legacy `small`, `middle`, `huge`, and
`fresh:*` commands MUST NOT remain public aliases after repository callers
migrate.

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

The `demo` profile MUST preserve the curated walkthrough formerly carried by
the small tier: multiple roles, green/yellow/red product health, multi-stage
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

Hard reset, migration seed, visual regression, UAT, developer reseed, and e2e
setup MUST select a canonical profile explicitly. No caller may depend on an
implicit `seed-simple.ts` default or an undocumented command-to-dataset mapping.

#### Scenario: Hard reset completes

- **WHEN** the hard-reset command is invoked with a canonical profile
- **THEN** it preserves the destructive guard, resets the accepted disposable
  target, writes that profile, and runs its validator

### Requirement: MVP data cutovers preserve safety, not old rows

Profile and schema changes MAY discard existing non-production MVP rows and MAY
use breaking reset-based cutovers. They MUST preserve the destructive database
guard and MUST NOT treat an unnamed external database as an execution target.

#### Scenario: A profile requires a reshaped schema

- **WHEN** the new architecture cannot read prior disposable rows
- **THEN** the migration/reset path may rebuild the database
- **AND** all four profile writers and proofs are adapted before completion
