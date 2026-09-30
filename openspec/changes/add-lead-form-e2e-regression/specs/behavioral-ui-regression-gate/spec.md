# Spec Delta

## ADDED Requirements

### Requirement: Lead browser regression has a complete source-bound capability inventory

The Lead browser regression for `/lead/report/:reportId` MUST have a tracked
capability inventory that maps every Lead-visible form action, conditional
control and read-only state to its current source and named browser test.
An uncovered capability MUST state its reason and MUST NOT be counted as
verified. The inventory MUST distinguish an implemented test from a successful
execution against the current source revision. Assistant scenarios using CLI
tRPC-response stubs MUST identify that UI response boundary and MUST NOT claim
backend provider integration from those stubs.

#### Scenario: A conditional Lead control is discovered

- **WHEN** a Lead-visible action is found in the form or an imported control
- **THEN** the inventory records its condition, source and named test
- **AND** any unexercised state has an explicit coverage limitation

#### Scenario: Static checks complete without browser execution

- **WHEN** source, types, formatting and specification checks pass without running a browser
- **THEN** the result proves static acceptance only
- **AND** no Lead capability is reported as live verified by that result

### Requirement: Lead browser regression exercises real authoring and review flows

The Lead browser regression MUST exercise dev-login, report opening, canonical
Overview creation and progress editing, all applicable More actions, Product
and Activity status, create/edit/delete in every editable section, draft
persistence, visible input limits and any available limit dialog, submit,
reopen and immutable Previous content through the visible UI. A requested
control absent from the current source MUST be recorded explicitly rather
than created by this regression change. The Request changes scenario MUST
submit the Lead section, let a Head request changes with a reason in the same
test, and show that exact reason to the owning Lead. Lead Request reopen
approval and rejection scenarios MUST each include the Head's real response in
that same test and verify the resulting Lead editability or submitted state.
Previous's historical occurrence MUST remain immutable; an applicable
`Plan this work` action MAY create active work in the selected editable section
without changing that predecessor. When supported CLI controls can reproduce a
save failure, the regression MUST verify recoverable input and a successful
retry, and identify the injection. If that failure cannot be reproduced through
the selected CLI, the inventory MUST record the precise limitation without
claiming coverage or adding another browser adapter. Assertions MUST observe the
result through accessible UI, relevant network responses or a persisted
refetch, rather than count a click as success. Native Deadline editing MUST use
supported CLI keyboard controls on fresh scoped spinbutton references selected
by their actual ARIA ranges, and read back the label-associated control's ISO
value before saving. It MUST NOT assume English accessibility names or mutate
the DOM through a script. A published-lineage Lead scenario MAY use real
same-test Head period publication and reopen to establish that conditional
state without expanding into a general Head regression suite.

#### Scenario: Head returns the Lead section with a reason

- **WHEN** the Lead submits and the Head requests changes with a valid reason
- **THEN** the owning Lead sees the reviewer's reason on the returned section
- **AND** the form is editable again according to the existing lifecycle rules

#### Scenario: Overview progress persists

- **WHEN** the Lead saves a Current or Next item through its Update progress editor
- **THEN** Overview shows the new state after saving and reloading
- **AND** Previous content remains unchanged and exposes no control that edits,
  moves, confirms or changes the status of its historical occurrence

#### Scenario: Historical replan preserves Previous

- **GIVEN** a Previous plan has no matching Current occurrence for its lineage
- **WHEN** the Lead uses its available Plan this work action
- **THEN** active work is created in the selected editable section
- **AND** the Previous occurrence and authoritative snapshot remain unchanged

#### Scenario: Head approves the Lead's reopen request

- **WHEN** the submitted Lead requests reopen and the Head approves it in the same test
- **THEN** the owning Lead can edit the returned section according to existing lifecycle rules
- **AND** the pending request disappears

#### Scenario: Head rejects the Lead's reopen request

- **WHEN** the submitted Lead requests reopen and the Head rejects it in the same test
- **THEN** the owning Lead's section stays submitted and read-only
- **AND** the pending request no longer offers a response

#### Scenario: A save response fails once through supported CLI controls

- **WHEN** a test reproducibly rejects one draft-save transport response through the selected CLI
- **THEN** the UI reports the failure without claiming the input is saved
- **AND** retrying against the real backend persists the retained input

### Requirement: Lead browser tests prepare independent disposable state

Every Lead browser test MUST receive fresh named browser session state and prepare its
own mutable report state through UI actions or an explicit guarded reset and
seed fixture plan. Tests MUST NOT require another test's mutations or execution
order. Preparation MUST confirm previous owned browser cleanup before any
per-test destructive reset. Fixture preparation MUST preserve the existing period lifecycle tuple
and stable-lineage rules, including the unique section/Item-lineage key; an
explicit Next fixture MUST use the existing Current occurrence's independent
commitment rather than duplicate that occurrence. Default preparation MUST
preserve the canonical demo baseline with its narrow guarded overlay and the
canonical minimal profile without overlay. Only an explicit
`archived-fill-only` variant on the minimal profile MAY add a schema-valid
archived published own-Lead Planning source and frozen published snapshot for
the empty Fill-source hint and archived-picker condition. Other profiles MUST
reject that variant before spawning preparation or resetting. Each conditional
scenario MUST prepare its own source, not inherit a prior test's history.
Interactions under test MUST use existing authorized application writes.

#### Scenario: One scenario is selected alone

- **WHEN** any Lead browser scenario is executed alone against its seeded fixture
- **THEN** its required users, report, assignments and predecessor state are available
- **AND** it does not depend on a prior browser test

#### Scenario: Minimal-state test prepares an empty authoring baseline

- **WHEN** the minimal-state Lead scenario prepares its own fixture
- **THEN** the guarded canonical minimal profile is seeded without a demo overlay
- **AND** neither a preceding test's data nor duplicated Item lineage is inherited

#### Scenario: Empty Fill source retains an archived picker option

- **WHEN** that scenario explicitly prepares minimal with the archived-fill-only variant
- **THEN** its own archived published source and frozen snapshot are created in the guarded preparation group
- **AND** ordinary demo and minimal preparation remain unchanged
- **AND** the empty quick-fill hint and archive-toggle behavior are checked through the real Lead controls

### Requirement: Cancelled preparation leaves no owned database writers

The browser regression's preparation MUST contain the full guarded reset,
explicit seed and applicable overlay in one owned child process group. On hook
cancellation, timeout or failure, the parent MUST stop that group and await its
completion before starting another test. The parent MUST NOT perform overlay
writes outside that group. Browser cleanup MUST close only the current test's
owned sessions through a context independent of its cancelled test signal.
Cleanup MUST NOT target the coordinator's application processes or other sessions.
Runtime shutdown handlers MUST be installed before the first global
preparation. SIGINT or SIGTERM MUST cause a terminal abort that rejects future
preparation/browser work, waits for owned preparation and CLI-client completion,
and independently closes owned sessions and removes temporary CLI configuration
before exiting with code 130 or 143 respectively. A session-close rejection
MUST NOT skip temporary configuration removal, and any cleanup failure MUST be
reported explicitly.

#### Scenario: A test hook aborts during fixture preparation

- **WHEN** a fixture hook aborts while reset, seed or overlay is still running
- **THEN** the owned preparation group is stopped and its completion is awaited
- **AND** no next test or successful completion is reported while its writers remain active

#### Scenario: A browser interaction is cancelled

- **WHEN** a browser test signal is aborted after it opened its own Lead or Head sessions
- **THEN** cleanup can still close those sessions through its independent context
- **AND** other sessions and application processes remain untouched

#### Scenario: Runtime receives a termination signal

- **WHEN** the test worker receives SIGINT or SIGTERM during owned runtime work
- **THEN** it blocks further work and settles owned operations before cleanup
- **AND** owned sessions and temporary CLI configuration are cleaned through an independent context
- **AND** it exits 130 for SIGINT or 143 for SIGTERM

### Requirement: Browser regression destructive setup fails closed on the exact authorized target

The Lead browser regression setup MUST accept only an explicit loopback
PostgreSQL target named exactly `customreport_e2e`, accepted by the repository
destructive guard with `NODE_ENV` non-production and
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'`. It MUST display the target
without credentials and perform a guarded reset followed by an explicit seed
before browser execution. All regression Redis clients and any cleanup MUST
use logical DB 15; cleanup MUST pass the same PostgreSQL guard and consent.
Target mismatch, missing consent or another Redis DB MUST fail before a
destructive operation. Browser execution MUST require the coordinator's
explicit handoff of the shared target and MUST NOT start web or API servers.

#### Scenario: Setup receives a runtime lane or another database

- **WHEN** setup receives any database name other than `customreport_e2e`
- **THEN** it refuses before connecting or resetting
- **AND** no PostgreSQL or Redis state is changed

#### Scenario: Redis DB or per-command consent is absent

- **WHEN** `REDIS_DB` is not exactly `15` or the exact consent is missing
- **THEN** setup fails before reset, seed or Redis cleanup

### Requirement: Browser regression uses the selected CLI with native Node tests

The `pnpm test:e2e` consumer MUST run TypeScript `node:test` scenarios through
the installed `agent-browser` CLI. Browser operations MUST invoke real CLI
commands without a shell or an alternative browser adapter. Each run MUST use
a uniquely named session within its worktree and retain that session identity
across its commands. Head operations in one scenario MUST use a separate owned
session. Setup and module imports MUST NOT launch browsers or connect to
services during static checks. Current implementation MUST NOT run browser
tests, session creation, reset or seed while the shared target is occupied.

#### Scenario: Future run acquires its browser identity

- **WHEN** the coordinator starts an authorized regression run after target handoff
- **THEN** setup creates a unique worktree-scoped session and passes its identity to CLI commands
- **AND** only sessions owned by that run are closed on completion or failure

#### Scenario: Static checks inspect the regression sources

- **WHEN** the repository performs static checks before runtime handoff
- **THEN** no browser, database or Redis operation starts
- **AND** command help or a static source inventory cannot be reported as a passed browser flow

### Requirement: Browser regression remains separate and produces external artifacts

The repository MUST expose the Lead browser regression through
`pnpm test:e2e`, separately from `pnpm test` and `.gitlab-ci.yml`. Browser
outputs MUST be written outside the repository. Delivery evidence MUST record
exit codes for `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and
`pnpm spec:check`, with all four required to be zero. Other unit/build results
MUST remain separate from browser acceptance. Browser execution MUST remain
explicitly pending whenever it was not run. A discovery or help command
MUST NOT be treated as runtime proof.

#### Scenario: A browser run emits output or snapshots

- **WHEN** the regression runner emits a screenshot, snapshot, log or report
- **THEN** the artifact resides outside the repository
- **AND** ordinary unit/CI entrypoints remain unchanged

#### Scenario: Delivery happens under the current runtime prohibition

- **WHEN** all four static gates pass but browser execution remains forbidden
- **THEN** the report records those exact exit codes and the coordinator command
- **AND** it records browser runtime acceptance as pending
