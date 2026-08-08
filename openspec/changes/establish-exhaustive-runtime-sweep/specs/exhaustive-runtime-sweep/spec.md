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

### Requirement: Matrix finalization is deterministic and executable

The campaign SHALL first prepare every nominal route/state segment and freeze
its semantic live-DOM control inventory. It SHALL then persist one ordered
`MATRIX.json` whose digest is referenced by the campaign manifest. Every row
SHALL be either one executable navigation, idle, control, recovery, fault,
concurrency, or infrastructure case, or one typed inapplicable combination with
a stable constraint id and reason. Pairwise requirements SHALL be derived from
the legal finalized rows rather than a separate raw Cartesian model.

Each executable row SHALL contain exactly one bounded action or observation.
Its control-transition value SHALL match its action transition, and every
non-`none` fault SHALL carry a named fault id and execution declaration in the
same row. Limits SHALL apply to the total finalized case set and SHALL abort
before baseline execution rather than trimming cells.

#### Scenario: live applicability is frozen before baseline

- **WHEN** deterministic preflight completes for the declared source, profiles,
  routes, and states
- **THEN** the final ordered cells, typed inapplicable records, counts, limits,
  and digest are written to `MATRIX.json`
- **AND** the baseline replays that file without adding newly discovered cells

#### Scenario: an invalid specialized witness fails finalization

- **WHEN** a transition disagrees with its action, a non-`none` fault lacks a
  fault id, an axis value has neither an executable row nor a typed reason, or
  the total case limit is exceeded
- **THEN** matrix finalization fails before baseline execution
- **AND** a `none` value or silently trimmed row cannot satisfy the gap

#### Scenario: preflight changes destructive state groups

- **WHEN** preflight moves to a state group that requires a profile reseed
- **THEN** it quiesces the prior browser document before replacing database rows
- **AND** the API runs as a one-shot process without source-watch restarts
- **AND** the campaign persists the preflight API log before navigation so an internal error can be adjudicated from server evidence

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

The typed identity SHALL also include a discriminated execution kind and, for a
controlled fault, its fault id. One navigation cell that performs several
controls MUST NOT stand in for distinct control-action cells.

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

### Requirement: Parallel deterministic replay uses exclusive lanes

The frozen executable matrix MAY be replayed through bounded parallel lanes.
Every active lane SHALL own a distinct disposable E2E database, Redis instance,
API port, web port, browser process, Next.js dist directory, queue namespace,
log/PDF directory, and archive subtree. Each lane SHALL use exactly one
Playwright worker and execute its assigned cells sequentially. A database or
mutable browser/server resource MUST NOT be shared by concurrent lanes.

The planner SHALL assign every selected frozen case to exactly one lane without
changing its cell identity. The canonical merger SHALL reject duplicate,
missing, extra, stale-SHA, non-pass, digest-mismatched, or cross-lane evidence
before publishing. A full run SHALL prove that the merged union equals the
complete executable matrix. Lane count and assignment digest MAY change without
changing `MATRIX.json` or its digest.

#### Scenario: isolated lanes replay one frozen matrix

- **WHEN** the operator requests more than one deterministic lane
- **THEN** readiness proves distinct databases, Redis identities, service ports,
  output roots, and source-bound assignments before any reset or browser starts
- **AND** every lane runs serially against only its own resources

#### Scenario: the merger fails closed on incomplete parallel output

- **WHEN** a lane fails, exits without an assigned cell, writes an unexpected
  cell, references stale or missing evidence, or duplicates another lane's cell
- **THEN** all owned processes are terminated and canonical publication is
  refused
- **AND** the partial lane archives remain available for diagnosis

#### Scenario: the selected lane count is benchmarked rather than assumed

- **WHEN** the operator increases the lane count for a machine
- **THEN** one-cell and full-group canaries prove correctness, clean teardown,
  and positive measured throughput scaling before the full run
- **AND** a slower or resource-unstable count is rejected in favor of the
  fastest stable measured count

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

#### Scenario: a controlled fault allows only its exact event

- **WHEN** a fault phase observes the declared operation, method, status or
  transport failure, and exact count
- **THEN** only that matching event is classified as expected
- **AND** an additional HTTP response, transport failure, server error, or the
  wrong count fails the cell

### Requirement: Function, accessibility, observability, and visual evidence is SHA-bound

Every terminal cell SHALL attach evidence for each applicable oracle dimension:
functional behavior (action plus machine-checkable state/response assertion),
accessibility (axe result plus relevant role/name/status observations),
observability (browser console/page errors, request timeline, API and worker
logs, and correlated Bugsink/Loki events), and visual outcome. Visual evidence
SHALL include stable screenshots immediately before and after every bounded
transition at Chromium 1440x900, compared with the immutable baseline or an
explicit visual oracle. Each artifact SHALL include the cell id, source SHA,
profile, role, route, state, action, and capture timestamp; the ledger SHALL
reject an artifact that is missing its binding or whose SHA differs from the
campaign.

The screenshot and its paired geometry SHALL be captured at the same settled
boundary before keyboard traversal, axe injection, or other evidence
instrumentation can change focus or scroll position. Same-route transitions
SHALL compare stable landmark topology and movement. A read-only link may mask
cross-route landmark topology and movement only when immutable successful URL
artifacts prove a same-origin transition to the declared target path or its
redirected descendant. Viewport, overflow, loading, duplicate-key, malformed,
and keyed zero-size checks SHALL remain blocking on both route snapshots.

Run-level observability artifacts SHALL also bind the matrix digest, assignment
digest, run id, lane id, profile, run-scoped service name, and content digests
of every required raw artifact. The merger SHALL reject stale, foreign-run,
loose, symlink-substituted, digest-mismatched, or incomplete evidence before it
reads cell verdicts.

The observability adjudicator SHALL identify undeclared failures, repeated or
unbounded requests, retry storms, missing or ineffective cache behavior where
the route declares a cache expectation, slow-request outliers, queue failures,
and Bugsink/Loki events correlated to the cell time window and correlation id.
A green browser assertion MUST NOT override an observability failure or a
missing correlation query. Expected requests and controlled faults SHALL be
declared so the adjudicator can distinguish intended behavior from noise.
The raw browser ledger SHALL retain a Chromium navigation abort for an SDK
Sentry envelope, but the adjudicator MAY exclude it from the unexpected
transport-failure count only when the request is `POST`, the resource type is
`fetch`, the failure text is exactly `net::ERR_ABORTED`, the path is
`/api/<numeric-project>/envelope/`, its origin, numeric project, and public key
match the configured Bugsink DSN, `sentry_version` is exactly `7`, and the
single non-empty `sentry_client` begins with an explicitly allowed
browser-capable SDK signature: `sentry.javascript.browser/` or
`sentry.javascript.nextjs/`. The raw record SHALL retain its absolute URL so
this binding remains auditable. The same evidence window SHALL contain a
matching successful HTTP response for the request. The request-failure and
response records SHALL carry the same non-empty, immutable collector-assigned
request id; a response for another request SHALL NOT qualify. The evidence
message SHALL state the excluded count. This policy
SHALL apply to initial, action, recovery, and final-tail windows. A missing or
failed matching response, empty, duplicate, foreign, server-only, or otherwise
mismatched marker or a product API abort SHALL remain blocking.
The browser ledger SHALL stay attached until tracked API requests settle, log
collection SHALL wait a bounded interval for late correlated writes, and API
termination SHALL await app close, process-wide file-log flush, OpenTelemetry
shutdown, and Sentry close with a bounded attempt for every step.
The coordinated shutdown sequence SHALL be the sole process-signal owner and
SHALL close the Nest application exactly once when termination signals race.
The browser ledger SHALL use one advancing cursor across initial navigation,
before, action, after, and a final tail so every event is adjudicated exactly
once. The final tail SHALL update the owning cell before persistence and SHALL
fail the cell for any undeclared console, page, transport, or HTTP error.
For API/worker logs, the bounded clock-skew allowance SHALL apply only to exact
browser-response correlation IDs. An unmatched warning or error SHALL attach
to a cell only inside the strict phase interval; an unmatched event outside all
strict cell intervals SHALL remain in immutable profile-wide canonical API-log
evidence and SHALL block campaign acceptance until dispositioned.

For a stateful control, the action attempt and destructive recovery SHALL use
separate evidence windows. The action window SHALL close after its bounded
functional outcome and before reset/reseed/login/reload begins. Recovery SHALL
persist its own request, log, and state-oracle evidence. A recovery failure
SHALL block the campaign without being presented as a failure of the product
control attempt. The transition visual oracle SHALL compare the `before` phase
with the settled action-window result, never with the restored post-recovery
`after` phase. The post-recovery `after` phase SHALL prove only that the
deterministic baseline was restored.
For a confirmation-backed submit transition, opening the confirmation surface
SHALL NOT satisfy the functional outcome. The executor SHALL locate the
`alertdialog` named `Confirm submission`, activate its scoped `Submit` action,
and observe the declared mutation before the action window closes.

After all API drains succeed, the API process SHALL create one immutable
identity-bound completion artifact. A parent test runner exit SHALL NOT
substitute for this artifact. Drain failure, timeout, completion-write failure,
missing completion, completion before the actual local shutdown barrier, or
completion outside the profile window SHALL block merge.

At merge time, the observability validator SHALL re-read canonical local logs
and perform a fresh bounded Loki query for counts and the shutdown marker. A
profile report or regenerated manifest whose declared counts do not equal the
live result SHALL be rejected even when its local files are internally
consistent.

#### Scenario: a passing cell has complete evidence

- **WHEN** a cell reaches `pass`
- **THEN** its ledger record links the required function, accessibility,
  observability, and before/after visual evidence (or a typed inapplicable
  reason) and each link resolves to an artifact with matching identity fields
- **AND** the cell is not considered terminal if any required evidence is
  absent

#### Scenario: a visual regression is blocking

- **WHEN** the visual oracle detects a difference outside its declared stable
  masking rules
- **THEN** the cell receives a `fail` verdict with the before/after evidence
- **AND** a matching functional or accessibility pass cannot hide the visual
  gap

#### Scenario: a green browser action has dirty runtime telemetry

- **WHEN** the browser assertion passes but the cell window contains an
  undeclared console/page/API/worker error, a correlated Bugsink event, a
  missing required Loki query, an unexpected repeated request, or an exceeded
  request-duration threshold
- **THEN** the cell receives a `fail` verdict with the relevant timeline and
  log evidence
- **AND** local fallback behavior cannot convert the cell to `pass`

#### Scenario: an SDK envelope abort does not hide a product failure

- **WHEN** Chromium aborts an exact Sentry envelope fetch during navigation
- **THEN** the raw request failure remains attached and its excluded count is
  reported without failing the cell only when its matching response succeeded
- **AND** an abort with different method, resource type, failure text, path, or
  configured origin, project, public key, protocol version, or browser-client
  marker remains an unexpected transport failure
- **AND** a product API abort remains blocking even when its failure text is
  `net::ERR_ABORTED`

#### Scenario: terminal evidence waits for late runtime events

- **WHEN** an API request or correlated file-log record begins before the cell
  evidence window closes but completes shortly afterward
- **THEN** the bounded settle/drain sequence includes it in adjudication
- **AND** a timeout or failed telemetry drain is blocking and cannot produce a
  terminal `pass`

#### Scenario: stateful recovery does not contaminate action evidence

- **WHEN** a stateful control reaches its bounded product outcome and the
  subsequent reset, reseed, login, or route reload emits a warning or error
- **THEN** the action evidence contains only the product-attempt interval
- **AND** the recovery evidence records the later event and blocks the campaign
- **AND** neither ledger may omit or duplicate the event

#### Scenario: submit transition includes the scoped confirmation action

- **WHEN** a frozen `submit` control opens the `Confirm submission`
  `alertdialog`
- **THEN** the executor activates the dialog's scoped `Submit` action and
  proves the mutation before recovery
- **AND** a native form submit, missing dialog, or missing scoped confirmation
  remains ambiguous and cannot produce a passing submit transition

#### Scenario: a profile report cannot fabricate Loki delivery

- **WHEN** local logs, a profile report, and its manifest declare matching clean
  counts but the merge-time Loki query returns no matching records
- **THEN** the profile is rejected before cell verdicts are merged
- **AND** regenerated digests cannot convert the missing live evidence to pass

#### Scenario: API completion proves every shutdown drain

- **WHEN** app close, the shutdown barrier, file-log flush, OpenTelemetry, or
  Sentry fails or exceeds its deadline
- **THEN** the API still attempts every remaining drain but does not publish a
  valid completion artifact
- **AND** a successful parent runner exit cannot satisfy the completion gate
- **AND** racing termination signals cannot close the application or exit the
  process more than once

#### Scenario: a transition has stable before and after evidence

- **WHEN** a bounded action changes route, mode, disclosure, dialog, filter,
  period, scope, or persisted state
- **THEN** the cell stores screenshots immediately before the action and after
  the declared settled state using the same viewport and masking policy
- **AND** screenshot and geometry capture precede keyboard and axe
  instrumentation at each settled boundary
- **AND** same-route geometry, overflow, loading-state replacement, and
  unexpected visual movement are adjudicated from that pair
- **AND** a proven cross-route read-only link may mask only landmark topology
  and movement comparison while snapshot-local visual failures remain blocking

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
outcomes, and no functional, accessibility, observability, or visual gap remains
unresolved or confirmed. The final report SHALL include the matrix and exclusion digests,
cell counts by verdict, finding dispositions, and links to the immutable
baseline and final rerun ledgers. Excluded engines and viewports SHALL be
listed as excluded and SHALL never contribute to covered counts.

#### Scenario: a pending or confirmed gap blocks completion

- **WHEN** any cell is pending/blocked, any inventory item is unreasoned, or a
  functional, accessibility, observability, or visual finding is unresolved or
  confirmed
- **THEN** the stop gate returns a non-zero failure verdict and names the gap
- **AND** no completion report is published

#### Scenario: a clean final SHA closes the campaign

- **WHEN** every declared cell is terminal `pass`, every candidate is
  dispositioned with evidence, and the final full rerun is bound to one SHA
- **THEN** the stop gate returns success with zero unresolved or confirmed gaps
- **AND** the report explicitly states that Firefox, WebKit, mobile, and tablet
  were excluded rather than covered
