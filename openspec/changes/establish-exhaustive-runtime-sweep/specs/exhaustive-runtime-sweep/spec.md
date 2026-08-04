## ADDED Requirements

### Requirement: The campaign declares a closed browser and coverage matrix

The Exhaustive Runtime Sweep campaign manifest consumed by `e2e/sweep/` SHALL
declare a finite matrix of the canonical roles (`lead`, `head`, `admin`, and
`viewer`), every role-reachable route from `e2e/catalog/<role>.yaml`, the
named deterministic seed profiles, the state kinds, and the actions to be
exercised. The browser engine SHALL be Chromium and the viewport SHALL be
exactly 1440x900 for every declared cell. Firefox, WebKit, mobile, and tablet
are explicit exclusions; the campaign MUST record those exclusions and MUST
NOT report them as covered.

#### Scenario: a matrix omits an unsupported browser or viewport

- **WHEN** a campaign manifest names Firefox, WebKit, a mobile/tablet device,
  or a viewport other than 1440x900
- **THEN** manifest validation fails before any cell runs
- **AND** the unsupported combination is reported as excluded rather than
  covered

#### Scenario: the matrix is finite and role-reachable

- **WHEN** the campaign is prepared from the role catalogs and declared seed
  profiles
- **THEN** every role-reachable catalog route has at least one declared cell
- **AND** the manifest contains a finite, serializable matrix digest that
  identifies the exact profile, role, route, state, and action set

### Requirement: Every coverage cell has a typed identity and one source SHA

The canonical evidence ledger owned by the primary orchestrator SHALL represent
each declared cell as a typed record with all of the following fields:
`cellId`, a 40-character lowercase `sourceSha`, `profile`, `role`, catalog
`route`, resolved route, `viewport` (`chromium`, width `1440`, height `900`),
deterministic `state`, `action`, `oracle`, and terminal `verdict`. `profile`
SHALL be one of the checked-in seed profiles (`minimal`, `demo`, `full`, or
`stress`); `role` SHALL be one of the four canonical roles; `verdict` SHALL be
`pass`, `fail`, or `blocked`. Cell identity SHALL include a stable digest of
the state and action sequence so that two distinct executions cannot silently
share a cell id.

#### Scenario: a cell with missing or malformed identity is rejected

- **WHEN** a ledger writer omits a required field, uses an unknown role/profile,
  uses a non-SHA source identifier, or records a non-terminal verdict
- **THEN** ledger validation rejects the record and the campaign cannot reach a
  completion verdict

#### Scenario: a mixed-SHA ledger cannot be complete

- **WHEN** one cell or artifact in a campaign carries a `sourceSha` different
  from the campaign baseline SHA
- **THEN** the ledger marks the campaign invalid and names the mismatched cell
  or artifact
- **AND** no result from that campaign is presented as a complete sweep

### Requirement: Runtime enumeration inventories controls and reachable transitions

After each route settles, the owned Playwright harness under `e2e/sweep/` SHALL
derive a semantic inventory from the live DOM rather than a frozen per-element
list. The inventory SHALL include every visible interactive control and
control-bearing landmark (including links, buttons, form fields, tabs,
comboboxes, dialogs, and elements with an interactive ARIA role), its role,
accessible name, enabled/disabled state, deterministic DOM-order identity, and
the cell id. Newly reachable controls SHALL be inventoried after each bounded
transition. Every inventory entry SHALL receive a safe representative action
and an observable oracle result, or a typed `not-exercised` disposition whose
reason is recorded in the ledger; an unreasoned omission is a gap.

#### Scenario: a dynamically revealed control is covered

- **WHEN** an action opens a menu, dialog, tab panel, or otherwise reveals a
  control that was absent from the prior inventory
- **THEN** the next inventory contains that control with a deterministic
  identity
- **AND** the ledger records its action, oracle observation, and terminal cell
  verdict

#### Scenario: an unreasoned control omission fails coverage

- **WHEN** a visible interactive control has no action result and no typed
  `not-exercised` reason permitted by the campaign policy
- **THEN** the owning route/state cell is `fail` and the stop gate remains open

### Requirement: State and transition profiles are deterministic and pairwise

The sweep SHALL execute deterministic nominal, boundary, lifecycle, and
permission states from the disposable E2E database and SHALL include explicit
controlled-failure states. The profile generator SHALL cover every declared
value of each state axis and every pairwise combination of the declared axes
for each applicable role and route. Given the same source SHA, seed profile,
matrix manifest, and fixed generator seed, it SHALL emit the same ordered state
ids, action sequences, and cell ids; wall-clock time, model output, and
unseeded randomness MUST NOT alter the matrix.

#### Scenario: pairwise state generation is reproducible

- **WHEN** the same source SHA and profile manifest are reset and generated
  twice
- **THEN** both runs produce identical state/profile digests and ordered cell
  identities
- **AND** a changed profile or matrix manifest produces a new digest rather
  than reusing the old baseline

#### Scenario: lifecycle and permission boundaries are exercised

- **WHEN** a route has declared open/reopened/published/archived lifecycle
  states or role-specific permission boundaries
- **THEN** the matrix contains the applicable boundary cells and their oracle
  states
- **AND** a route is not counted as exhaustive while any declared boundary
  cell is pending or omitted

### Requirement: Controlled faults have explicit recovery or non-mutation oracles

Fault injection for the sweep SHALL be deterministic, disposable, and scoped to
the operation named by a coverage cell. The controlled-failure set SHALL name
the fault id and type (for example an expected 4xx/5xx response, timeout, or
aborted request), the affected action, and the expected user-visible error,
accessible status, recovery path, or unchanged persisted state. A fault MUST
NOT target production data or be silently swallowed; an unexpected success,
uncaught error, mutation, or missing recovery signal is a failed cell.

#### Scenario: a controlled API failure is handled without mutation

- **WHEN** a declared fault causes an action request to fail in the disposable
  E2E database
- **THEN** the UI presents the declared error through an observable and
  accessible status, the recovery action is exercised when declared, and the
  persisted state remains unchanged when the oracle requires non-mutation
- **AND** the fault id and evidence are attached to the same coverage cell

#### Scenario: an undeclared fault is not treated as expected behavior

- **WHEN** a network, console, or server failure occurs without a matching
  controlled-failure declaration
- **THEN** the cell receives a `fail` verdict with the failure evidence
- **AND** the event cannot be dismissed as a passing fault case

### Requirement: Function, accessibility, and visual evidence is SHA-bound

Every terminal cell SHALL attach evidence for each applicable oracle dimension:
functional behavior (action plus machine-checkable state/response assertion),
accessibility (axe result plus relevant role/name/status observations), and
visual outcome (a screenshot at Chromium 1440x900 compared with the immutable
baseline or an explicit visual oracle). Each artifact SHALL include the cell
id, source SHA, profile, role, route, state, action, and capture timestamp; the
ledger SHALL reject an artifact that is missing its binding or whose SHA differs
from the campaign.

#### Scenario: a passing cell has complete evidence

- **WHEN** a cell reaches `pass`
- **THEN** its ledger record links the required function, accessibility, and
  visual evidence (or a typed inapplicable reason) and each link resolves to an
  artifact with matching identity fields
- **AND** the cell is not considered terminal if any required evidence is
  absent

#### Scenario: a visual regression is blocking

- **WHEN** the visual oracle detects a difference outside its declared stable
  masking rules
- **THEN** the cell receives a `fail` verdict with the before/after evidence
- **AND** a matching functional or accessibility pass cannot hide the visual
  gap

### Requirement: The baseline is immutable and reruns are explicit

The primary orchestrator SHALL persist one immutable baseline ledger and matrix
manifest before fixes are applied. A fix MUST NOT edit, delete, or overwrite
baseline cells or artifacts. A rerun SHALL identify its parent baseline and its
new source SHA, rerun every affected cell after each fix, and execute the full
declared matrix once at the final SHA; results from different SHAs MUST remain
separate and MUST NOT be merged into one verdict.

#### Scenario: a fix creates a linked rerun

- **WHEN** a source change is made after a baseline cell fails
- **THEN** the affected cell is rerun in a new ledger linked to the immutable
  baseline and records the new source SHA
- **AND** the original failure evidence remains unchanged and addressable

#### Scenario: final completion requires a full final rerun

- **WHEN** the orchestrator attempts to close a campaign after fixes
- **THEN** the ledger proves that every declared cell ran at the final SHA,
  including cells that passed in the baseline
- **AND** a partial or mixed-SHA rerun cannot close the campaign

### Requirement: The zero-gap stop gate is terminal and explicit

The campaign stop gate SHALL pass only when every declared coverage cell is
terminal at one source SHA, every control and transition has a result or an
allowed typed disposition, all controlled faults have their declared oracle
outcomes, and no functional, accessibility, or visual gap remains unresolved
or confirmed. The final report SHALL include the matrix and exclusion digests,
cell counts by verdict, finding dispositions, and links to the immutable
baseline and final rerun ledgers. Excluded engines and viewports SHALL be
listed as excluded and SHALL never contribute to covered counts.

#### Scenario: a pending or confirmed gap blocks completion

- **WHEN** any cell is pending/blocked, any inventory item is unreasoned, or a
  functional, accessibility, or visual finding is unresolved or confirmed
- **THEN** the stop gate returns a non-zero failure verdict and names the gap
- **AND** no completion report is published

#### Scenario: a clean final SHA closes the campaign

- **WHEN** every declared cell is terminal `pass`, every candidate is
  dispositioned with evidence, and the final full rerun is bound to one SHA
- **THEN** the stop gate returns success with zero unresolved or confirmed gaps
- **AND** the report explicitly states that Firefox, WebKit, mobile, and tablet
  were excluded rather than covered
