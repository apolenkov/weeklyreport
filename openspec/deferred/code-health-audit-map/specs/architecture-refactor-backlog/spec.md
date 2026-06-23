# architecture-refactor-backlog (delta)

## MODIFIED Requirements

### Requirement: The lead-form god component is a recorded decomposition target

The backlog MUST record `apps/web/src/components/lead/lead-form.tsx` as a
decomposition target whose current evidence (code-LOC, peak cognitive
complexity) lives in the code-health register `docs/code-health-map.md`, not as
hard-coded numbers in this spec. The file is reduced in recorded slices, each
captured as its own grilled refactor change before work starts; the first
landed slice is `refactor-lead-mappers` (pure cross-author and snapshot
derivations moved to tested adapters in `apps/web/src/lib/mappers/`). The
decomposition target stays open; the deferred `ReportDataCoordinator` /
`FormStateManager` objects MUST NOT be built outside a future grilled change of
their own.

#### Scenario: the lead-form size target is discoverable

- **WHEN** a maintainer looks for known oversized modules
- **THEN** the register names `lead-form.tsx` with its current code-LOC and the
  300 target
- **AND** it lists the landed slices (first: `refactor-lead-mappers`) and marks
  the remaining decomposition as needing its own grilled refactor change before
  work starts

#### Scenario: a second slice starts

- **WHEN** an agent or maintainer picks up further lead-form decomposition work
- **THEN** a grilled OpenSpec change exists for that slice before any code is
  written
- **AND** the change cites the updated code-LOC evidence from the register

## ADDED Requirements

### Requirement: The register MUST be reproducible and staleness-stamped

The code-health register `docs/code-health-map.md` MUST be the single home of
the backlog's quantitative evidence, and every quantitative claim in it (LOC,
complexity, churn, rank) MUST trace to a recorded, re-runnable command. The
register MUST carry a staleness stamp recording the commit hash it was generated
against, the date, and the versions of the tools used. Stale numbers in any
legacy spec prose are superseded by the register.

#### Scenario: a maintainer regenerates the register

- **WHEN** a maintainer re-runs the recorded evidence commands at a later commit
- **THEN** the register's numbers reproduce from those commands alone
- **AND** the register records the commit hash, date, and tool versions it was
  last generated against

#### Scenario: the register is consulted after drift

- **WHEN** a reader opens `docs/code-health-map.md`
- **THEN** the staleness stamp tells them which commit the evidence reflects
- **AND** stale numbers are treated as evidence to regenerate, not current fact

### Requirement: Every per-file lint exemption MUST be re-attested with current evidence

Every file carrying a per-file lint exemption in `eslint.config.ts` MUST appear
in the register with a re-attestation verdict, backed by current code-LOC and
peak cognitive complexity. This covers EVERY per-file rule disable — including
`max-lines`, `complexity`, `cognitive-complexity`, and `sonarjs/no-nested-functions`
— not a chosen subset. A verdict MUST be re-derived from current evidence, never
copied from the existing ESLint comment, and MUST be one of: CONFIRMED, CONTESTED,
or OBSOLETE.

#### Scenario: an existing justification holds

- **WHEN** the register re-attests an exempted file whose exemption still holds
- **THEN** the entry is CONFIRMED with the current code-LOC and peak cognitive
  complexity that justify it

#### Scenario: an existing justification no longer holds

- **WHEN** the register re-attests an exempted file whose exemption is no longer
  warranted but the file still exceeds the standard
- **THEN** the entry is CONTESTED with a proposed split boundary and split risk

#### Scenario: an exemption is no longer needed

- **WHEN** the register re-attests an exempted file that now meets the standard
  without the exemption
- **THEN** the entry is OBSOLETE and recommends removing the exemption line from
  `eslint.config.ts`

### Requirement: The named architectural targets MUST be carried with dimension-appropriate evidence

The register MUST carry the existing named architectural targets that are not
size exemptions — the scattered client-permission model, the re-typed
traffic-light value, and the repository Prisma-type leak — using evidence that
fits their kind (e.g. spread count of duplicated sites, the boundary crossed),
and a verdict of STILL-PRESENT or RESOLVED with its scope. The size-exemption
verdict vocabulary (CONFIRMED / CONTESTED / OBSOLETE) MUST NOT be forced onto
these architectural targets.

#### Scenario: a re-typing target is carried

- **WHEN** the register records the traffic-light single-source-of-truth target
- **THEN** it shows the current count of re-typed sites as its evidence
- **AND** a STILL-PRESENT or RESOLVED verdict, not CONFIRMED/CONTESTED

### Requirement: The register MUST rank targets by a reproducible hotspot score

Targets MUST be ranked by a hotspot score combining structural cost (code-LOC
plus peak cognitive complexity), change frequency (git churn over a recorded
window), and risk-zone weight (HOT ZONE per `code-quality-modernization`).
Normalization MUST use absolute, pinned divisors (e.g. code-LOC over the 300
standard, peak cognitive complexity over the 15 standard) so a given file's
score does not move when the candidate set changes. Rank MUST NOT be determined
by file size alone.

#### Scenario: a small hot risky file outranks a large cold one

- **WHEN** a small, frequently-changed HOT ZONE file is ranked against a large,
  rarely-changed, cohesive UI file
- **THEN** the small HOT ZONE file ranks higher
- **AND** the rank cites its churn and risk-zone weight as the reason

#### Scenario: a score reproduces when the set changes

- **WHEN** an unchanged file is re-ranked after other files are added or removed
- **THEN** its hotspot score is unchanged, because divisors are absolute, not
  set-relative

### Requirement: The register MUST declare every coverage dimension and mark deferred ones

The register MUST declare all maintainability dimensions in scope — size,
complexity, hotspot, structural/grouping, dead code / unused exports, and
harmful logic duplication — anchored to the ISO/IEC 25010 maintainability
sub-characteristics used as a coverage taxonomy only, not a certification score.
A dimension whose measurement needs tooling not yet present (dead-code,
duplication) MUST be declared and explicitly marked deferred to a dedicated
follow-up change (to be created when that dimension is picked up), so coverage
gaps are visible rather than silent. Dead-code and
unused-export findings, when measured, MUST be recorded as candidates guarded
against framework false positives (NestJS DI, Next.js route/segment exports,
tRPC type exports, barrels, seed and UAT scripts, dynamic imports).

#### Scenario: a gate-blind structural finding is recorded

- **WHEN** the read-only structural pass finds a file grouped against the repo's
  domain-folder convention
- **THEN** the register records it under structural/grouping with the convention
  it violates and the suggested home

#### Scenario: a tooling-dependent dimension is deferred

- **WHEN** the register is assembled before dead-code/duplication tooling is
  added
- **THEN** those dimensions are listed as in-scope but deferred to a dedicated
  follow-up change to be created
- **AND** the register does not silently omit them

### Requirement: The register MUST NOT authorize refactoring

The register MUST NOT serve as authorization to change code. Every entry MUST
require its own grilled OpenSpec change, with a characterization test written
first per `code-quality-modernization`, before any refactor begins. The register
MUST state that its entries MUST NOT be executed as a batch or in parallel, and
each entry MUST visibly carry its own map-entry Definition of Done so the ranked
list cannot be read as a task queue.

#### Scenario: a maintainer acts on a register entry

- **WHEN** a maintainer decides to address a ranked entry
- **THEN** a grilled OpenSpec change is created for that single entry first
- **AND** a characterization test pins the current behavior before any code
  changes

#### Scenario: an agent reads the ranked list

- **WHEN** an agent reads the ranked register
- **THEN** the explicit no-batch / no-parallel statement and the per-entry DoD
  prevent it from treating the list as a mass-refactor queue

### Requirement: Each register entry MUST separate entry-completeness from refactor-completeness

Each entry MUST define its own Definition of Done as "evidence gathered, verdict
recorded, rank assigned", kept explicitly distinct from the future refactor's
exit criterion (the module honestly meeting the 300-line / complexity standard
without an exemption). The two MUST NOT be conflated.

#### Scenario: an entry is complete as a register entry

- **WHEN** an entry has current evidence, a verdict, and a rank
- **THEN** the entry is complete for the purposes of the register
- **AND** the module's refactor remains open until a future grilled change lands
  it under the standard without an exemption
