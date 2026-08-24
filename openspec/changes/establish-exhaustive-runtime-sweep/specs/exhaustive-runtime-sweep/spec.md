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

#### Scenario: a catalog redirect has one exact landing route

- **GIVEN** a catalog route is an intentional redirect alias
- **WHEN** preflight or runtime replay navigates to its declared entry route
- **THEN** the frozen route declaration names the exact canonical landing URL,
  including its query string, and the browser must settle at that URL
- **AND** reveal discovery uses that landing pathname as its route boundary
- **AND** a missing declaration, a different redirect target, or a later action
  leaving that pathname fails closed instead of accepting the live URL as a
  fallback

#### Scenario: a resolver route uses state-bound outcomes instead of one alias landing

- **GIVEN** a catalog route resolves a target from prepared domain state or
  authentication/query outcome rather than performing one unconditional redirect
- **WHEN** preflight or runtime replay exercises the resolver entry
- **THEN** the route declaration does not claim one unconditional exact landing
  URL, while the entry route remains executable
- **AND** each expected outcome is bound to the prepared state identity, its
  state digest, and the campaign source digest
- **AND** the outcome set covers visible current, published fallback, empty,
  query error, and anonymous
- **AND** `empty` and `query error` are explicit route-local resolver scenarios
  in the frozen source rather than values inferred from lifecycle, ownership,
  an unrelated permission boundary, or an observed browser result
- **AND** the empty scenario removes every reporting-group grant for the seeded
  viewer only inside the guarded disposable state boundary, proves the resolver
  returned no report and the database oracle remained exact, and relies on the
  next canonical reseed to restore the seeded grants
- **AND** the query-error scenario injects one named fault scoped exactly to
  `reports.latestForViewer`, proves the exact error and retry UI, proves a
  successful fault-free retry, and proves no database mutation occurred
- **AND** both route-local scenarios have immutable declaration ids, explicit
  execution contracts, and source/state/fault evidence in preflight, matrix,
  replay, and coverage artifacts
- **AND** the minimum applicable profile is exercised and every inapplicable
  role-permission boundary, including a minimal profile without the required
  capability, is represented by a typed reason rather than silently omitted

#### Scenario: a viewer status resolver keeps its executable entry binding

- **GIVEN** the viewer catalog contains `/reports/latest` without a route-level
  landing declaration
- **WHEN** the route binding is compiled
- **THEN** its resolved entry remains `/reports/latest`
- **AND** profiles `demo`, `full`, and `stress` remain executable when they
  provide the required viewer-visible capability
- **AND** `minimal` is retained as an explicit typed inapplicable boundary when
  that capability is absent
- **AND** no static exact landing is invented to stand in for the resolver's
  state-bound outcomes

#### Scenario: a repair proves the exact failed segment before a full preflight

- **GIVEN** a preflight failure identifies one canonical source state
- **WHEN** the harness is repaired at a new clean source SHA
- **THEN** an immutable exact-segment canary selects that one `stateId` and
  executes the same preparation, navigation, inventory, reveal discovery, and
  database non-mutation paths as the full preflight
- **AND** the next full preflight is blocked until the matching canary passes at
  that SHA
- **AND** only the supported same-process repair chain may continue from that
  PASS into full preflight; a standalone or synthetic PASS artifact cannot
  authorize the full launch
- **AND** unknown, duplicate, stale-SHA, role-mismatched, route-mismatched, or
  profile-mismatched selectors fail before browser execution

#### Scenario: preflight resumes only at a verified state boundary

- **GIVEN** a full preflight was interrupted after one or more states reached a
  terminal PASS
- **WHEN** the operator resumes the same source-bound preflight assignment
- **THEN** an append-only journal proves the exact source SHA, source tree,
  source digest, plan digest, assignment digest, state identity, state digest,
  profile, role, route, and terminal artifact digest for every skipped state
- **AND** the runner re-proves a clean source, recreates the exact disposable
  state boundary, and restarts every failed, started-only, ambiguous, or
  incomplete state from its beginning
- **AND** the runner never resumes within a reveal path, browser action, or
  partially captured state
- **AND** duplicate, missing, reordered, stale-SHA, foreign-assignment,
  digest-mismatched, truncated, or tampered journal records fail closed
- **AND** the journal cannot authorize full launch, matrix finalization, or a
  PASS artifact by itself
- **AND** canonical `PREFLIGHT.json` is published only when the validated union
  of prior terminal states and newly completed states exactly equals the full
  ordered source plan at one SHA with no gap or duplicate

#### Scenario: reveal discovery continues only after a terminal candidate

- **GIVEN** one preflight state has a bounded reveal queue with more candidates
  than one child chunk can safely execute
- **WHEN** a child completes a candidate and reaches the cooperative chunk
  budget
- **THEN** it durably writes one archive-confined raw
  `PREFLIGHT_REVEAL_RECEIPT_CHUNK` only after
  the candidate result, counters, and terminal receipt are complete
- **AND** the result contains the exact source SHA/tree/tree digest,
  source/plan/state/selector/route identities, and a nonempty disjoint
  terminal-candidate receipt suffix with predecessor heads/counts
- **AND** every receipt binds its predecessor, current branch identity,
  deterministic candidate list/index/identity/action/input, terminal
  transition, post-action inventory/surface/URL/non-mutation proof, and exact
  action/branch/completed counters; queue/maps are reducer-derived rather than
  trusted snapshots
- **AND** preparation closures, Page objects, mid-action work, and browser state
  are absent from every result
- **AND** the only receipt-free result is an authority-free
  `PREFLIGHT_REVEAL_BOOTSTRAP` from ordinal zero with no grant and a zero chain
  when the initial candidate frontier is empty; the parent MUST hydrate its
  immutable genesis graph and independently re-derive exact run identity,
  genesis, source bounds, the empty candidate list, reducer state, and controls
  before it alone signs a zero-chain parent PASS and canary PASS
- **AND** an initial frontier with any eligible candidate still emits a
  nonempty receipt chunk and follows the existing parent-sealed execution-grant
  path; it MUST NOT be reclassified as a receipt-free bootstrap
- **AND** the parent rechecks live clean source before and after every child,
  validates the predecessor heads and suffix, deterministically reduces only
  the new suffix in its in-memory reducer, and seals only a valid execution
  grant with a fresh in-memory authority tag plus the bounded reducer snapshot
  required to restore controls, dynamic registrations, visited state paths,
  and exact preparations before passing it to the next child
- **AND** a fresh child recreates the disposable database/browser boundary,
  navigates the clean route, replays the canonical prefix, re-derives and
  validates the candidate list/order, restores the parent snapshot without
  receipt history, verifies the full reducer-state digest, then starts exactly
  at the next candidate
- **AND** a result before a completed candidate, stale/tampered/foreign or
  reordered receipt chain, duplicate/missing record, identity or digest drift,
  replaced immutable prefix, or non-progressing child fails before the next
  action
- **AND** continuation never restores mid-path, mid-action, or browser state,
  never appends terminal journal PASS, never accepts child-authored canary PASS,
  and never authorizes matrix/full-preflight completion
- **AND** any nonzero child exit, including a hard timeout or crash, is a real
  failure that terminates the current attempt; only a durably written
  cooperative receipt chunk may start the next child from the last sealed
  execution grant
- **AND** the child never authors COMPLETE or PASS; the parent accepts the
  suffix only when its reducer reaches an empty frontier, then rechecks source
  and alone writes the exact canary PASS artifact
- **AND** the launcher uses a source-derived finite repetition guard; this
  exact vertical slice proves canary only, while full/shard journal continuation
  remains NOT-PROVEN and cannot reuse canary results

#### Scenario: the parent proves host health before the next canary child

- **GIVEN** an exact `admin/demo` canary child has emitted a valid nonterminal
  receipt chunk and the parent has reduced it and sealed the next grant
- **WHEN** the parent publishes a source-bound host checkpoint request
- **THEN** the external host controller observes that exact request, evaluates
  one later sample with the existing 60-sample baseline, unchanged thresholds,
  and three-sample hysteresis, and publishes a healthy normal response
- **AND** the request and response are strict canonical newline-terminated JSON
  no larger than 16 KiB, regular mode-0600 files in a fresh mode-0700
  archive-confined mailbox, with exact predecessor, sequence, source, state,
  route, coverage, threshold, and self-digest bindings
- **AND** the parent waits exactly 5 seconds, validates the response and source
  identity, and launches the next child only after that response
- **AND** a missing, stale, duplicate, reordered, gapped, breached,
  non-normal, malformed, tampered, or pre-dating response terminates the
  current attempt without launching the next child
- **AND** the checkpoint root is parent-only, is absent from every Playwright,
  configuration, web, and API child environment, and carries no resume
  authority or secret
- **AND** the external controller accepts only a strict post-infrastructure
  baseline of exactly 60 healthy source-bound records, with canonical bytes,
  complete metrics, monotone timestamps/counters, regular non-symlink mode-0600
  files, and an exact baseline receipt digest echoed by every runtime response
- **AND** every runtime response has `phase: runtime`, and both its sample and
  controller-observation timestamps are strictly later than the request
  boundary; the controller has one in-memory attempt and cannot resume, grant,
  publish PASS, or reuse a prior predecessor chain
- **AND** the controller scans the mailbox before watcher setup and again after
  setup, with a bounded abort deadline, so a request cannot be lost during
  watcher installation

#### Scenario: an invalid specialized witness fails finalization

- **WHEN** a transition disagrees with its action, a non-`none` fault lacks a
  fault id, an axis value has neither an executable row nor a typed reason, or
  the total case limit is exceeded
- **THEN** matrix finalization fails before baseline execution
- **AND** a `none` value or silently trimmed row cannot satisfy the gap

### Requirement: Preflight capacity is source-bound and fails closed

The campaign SHALL publish a version-2 `SOURCE.json` whose strict capacity
contract contains the four explicit positive limits
`maxRevealMaterialEdges`, `maxRevealActions`, `maxControlsPerSegment`, and
`maxCases`. Their values SHALL be covered by the source digest; a missing or
tampered value SHALL invalidate the source, and a legacy version-1 source SHALL
be rejected before a new campaign launch rather than receiving a default or
backfilled value. Production preflight SHALL pass the three reveal limits from
that exact source artifact to reveal discovery independently. It SHALL reject a
segment whose discovered control count exceeds the source control limit before
accepting the overflowing dynamic registration or returning a segment that
could be recorded as a canary `PASS`. Live discovery and parent receipt replay SHALL
use the same pure control-cap check before extending the queue. Matrix
finalization SHALL repeat the source control and case checks using the two
matrix limit fields and SHALL reject over-capacity input without trimming rows;
the `MATRIX.json` limit schema remains limited to `maxCases` and
`maxControlsPerSegment`.

#### Scenario: source capacity tampering cannot preserve identity

- **WHEN** a source capacity field is missing or changed without the matching
  source digest
- **THEN** source parsing rejects the artifact before preflight or matrix work
  begins
- **AND** a version-1 source cannot satisfy a new launch by relying on an
  implicit compatibility default

#### Scenario: reveal edge and action limits are independent

- **WHEN** a source-bound reveal segment exceeds `maxRevealMaterialEdges` or
  `maxRevealActions`
- **THEN** discovery fails with the matching exact overflow before returning
  controls
- **AND** changing one limit does not silently change the other

#### Scenario: control overflow fails before canary publication

- **WHEN** a segment discovers more controls than its source-bound
  `maxControlsPerSegment`
- **THEN** production preflight rejects the segment before the caller can write
  a canary `PASS`
- **AND** live discovery and parent receipt replay reject the same dynamic
  overflow before accepting the overflowing registration or extending the queue
- **AND** finalization repeats the check and does not trim the discovered
  controls or finalized rows

#### Scenario: preflight changes deterministic states

- **WHEN** preflight moves from one deterministic state to the next
- **THEN** it clears origin storage, quiesces the prior browser document, and receives the runtime API idle acknowledgement before any database mutation
- **AND** an aborted client connection remains active until its tracked API operation settles; an untracked abort fails the bounded drain instead of permitting a reset race
- **AND** it reseeds only when the state group changes
- **AND** it clears origin storage again when authentication revisits the app after a reseed
- **AND** the API runs as a one-shot process without source-watch restarts
- **AND** the campaign persists the preflight API log before navigation so an internal error can be adjudicated from server evidence

#### Scenario: runtime reuses only an exact read-only preparation group

- **WHEN** multiple navigation, idle, or read-only control cells have no fault and share the exact source, profile, role, route target, route key, resolved route, profile capability, lifecycle, submission, ownership, permission, fault, and control-transition preparation key
- **THEN** the runner MAY prepare their server state once
- **AND** it still quiesces the browser, drains tracked API work, establishes the cell auth/storage boundary, navigates, executes, captures, and persists every cell independently
- **AND** mutating, recovery, fault, concurrency, infrastructure, and unknown executions receive isolated preparation and never consume the shared prepared state
- **AND** any non-pass cell stops the group without executing a later cell on uncertain state

### Requirement: Canonical SOURCE authority precedes every runtime effect

The campaign SHALL create `SOURCE.json` only through the canonical
`buildCampaignSource`/`writeCampaignSource` path. Before packet or gate
materialization and before any runtime-capable entrypoint may create a
directory, resolve destructive consent, spawn a child or server, launch a
browser, or access Docker, PostgreSQL, or Redis, one non-runtime validator
SHALL rebuild the expected source from the same clean repository inputs,
parse the supplied source, and require exact equality with the canonical
serialized bytes. Embedded source-digest validity alone SHALL NOT establish
canonical origin.

Only a successful exact comparison MAY publish one immutable
`SOURCE-VALIDATION.json` PASS receipt. The receipt SHALL bind the campaign id,
clean source SHA/tree/tree digest, source digest, plan digest, exact source-file
SHA-256 and byte length, validation time, and a self-digest. A failed validation
SHALL publish no FAIL receipt and SHALL leave an existing receipt unchanged.
The validator SHALL return the exact receipt-file SHA-256 to the invoking
process, and every consumer SHALL require that external value in addition to
the receipt's self-digest.
Every consumer SHALL recheck both the source and receipt without writing before
crossing its effect boundary. A copied packet SHALL carry both artifacts and
repeat the same semantic check over the copied bytes before resource
initialization.

#### Scenario: stale or synthetic source edits fail before effects

- **WHEN** `campaignId` or any other source field changes with a stale digest,
  a recalculated digest, reordered or whitespace-drifted bytes, a foreign
  campaign/SHA/tree, or bytes changed after receipt publication
- **THEN** validation rejects the source or receipt before packet, gate,
  filesystem, runtime/browser/server/resource child-process, browser, Docker,
  database, or Redis effects
- **AND** no regenerated internal digest or external envelope digest can
  convert the manual source into canonical authority
- **AND** read-only Git/tool subprocesses used by the canonical validator are
  permitted but cannot start product runtime or mutate project state

#### Scenario: only canonical serialization publishes PASS

- **WHEN** the existing canonical builder writes a source for the exact clean
  campaign SHA and the validator rebuilds the same source
- **THEN** exact canonical bytes may create one exclusive PASS receipt and a
  later check may verify it without writing
- **AND** a missing, tampered, rehashed, foreign, duplicate, or pre-existing
  receipt cannot be overwritten or accepted as authority

#### Scenario: direct runtime entrypoints cannot bypass source authority

- **WHEN** a preflight, diagnostic, capacity, failure-frontier, manifest,
  lane, coverage, AI-import, or live Playwright entrypoint is launched directly
- **THEN** it checks the exact source and receipt before its first side effect
- **AND** production entrypoints cannot import the raw source reader as an
  alternate authority path while the static harness remains non-runtime

### Requirement: Capacity calibration is diagnostic-only and terminal

The campaign SHALL calibrate production reveal limits through a separately
identified exact-source capacity survey. Its immutable plan SHALL bind the
exact source identity, one exact selector and resolved state/route, the reveal
graph limits, one browser child, a hard wall-time deadline, and bounded result
output. The survey SHALL execute one monolithic reveal queue with HAR, trace,
video, screenshots, continuation checkpoints, receipts, grants,
assignment/journal records, parent PASS, and canary publication disabled. It
SHALL publish a `COMPLETE` result only after the queue is empty and the live
source identity is rechecked. The result is diagnostic data only: no launcher,
gate, finalizer, or repair chain may accept it as canary, preflight, matrix, or
release evidence. The monolithic browser loop SHALL execute without an active
Playwright `TestInfo`, and queue traversal SHALL use iterative cursors so
completed API calls and adopted Promises are not retained for the lifetime of
the survey. Fixed-interval progress output MAY contain bounded scalar counters
and process memory values only; it is never terminal result or acceptance
evidence.

The capacity survey MAY configure an optional first-failure callback only
around terminal candidate execution. Before the candidate cursor advances, the
callback MAY publish one separately rooted
`PREFLIGHT_REVEAL_FAILURE_FRONTIER` diagnostic packet containing immutable
content-addressed branch, path, inventory, surface and canonical candidate-list
evidence. The packet SHALL bind the exact source SHA/tree/tree digest/source
digest, source plan digest, capacity-plan artifact digest, selector, state,
route, candidate index, candidate identity, representative input and action-key
digest. It SHALL rethrow the original failure and SHALL NOT publish or satisfy a
capacity result, continuation, resume, grant, PASS, canary, journal, matrix,
repair, release or acceptance artifact.

The frontier manifest SHALL be canonical and no larger than 65,536 bytes. Its
branch depth SHALL be at most 8. It SHALL declare positive per-file,
asset-count and aggregate-byte bounds, while the parser SHALL reject more than
64 content assets, an asset larger than 8,388,608 bytes, or aggregate
manifest-plus-asset bytes greater than 67,108,864. All paths SHALL remain under
one exact archive-confined packet root and SHALL resolve to regular non-symlink
files. Content assets SHALL be written and digest-read back before an
exclusive, synced, read-back-verified manifest is written last. Missing,
duplicate, stale, foreign, reordered, oversized, path-escaping, symlinked,
digest-drifted, partial or mutated evidence SHALL invalidate the packet before
browser launch.

A focused replay SHALL accept only a valid exact-source packet, create a fresh
disposable database/browser boundary, hydrate and restore the saved branch and
path, and re-derive the canonical candidates from the restored inventory. The
re-derived list, index, candidate identity, representative input and action key
SHALL match the packet before the unchanged production whole-surface boundary
is invoked without executing the final action. A serialized raw action SHALL
never authorize replay, and no replay outcome SHALL satisfy the survey's
empty-frontier result or any acceptance gate.

#### Scenario: a complete survey reports the terminal graph

- **WHEN** the exact selected state exhausts its reveal queue within every
  declared graph, time, child, and output bound
- **THEN** the survey records the terminal completed-candidate, action,
  material-edge, control, visited-state, and maximum-queue counts
- **AND** the result binds the exact plan and source identities and records an
  empty frontier

#### Scenario: an incomplete survey publishes no terminal counts

- **WHEN** the graph overflows, the deadline expires, the browser child exits
  nonzero, source identity drifts, or bounded output cannot be written
- **THEN** no `COMPLETE` capacity result is published
- **AND** partial counters, Playwright diagnostics, continuation output, or a
  pre-existing survey file cannot satisfy or weaken acceptance

### Requirement: Darwin host eligibility uses reclaimable capacity signals

The runtime host envelope SHALL retain raw-free page bytes in every snapshot
and receipt as diagnostic telemetry, but SHALL NOT treat raw-free pages as an
independent baseline or runtime veto on Darwin. Baseline eligibility SHALL fail
closed on available memory, system memory-pressure state and free percentage,
swap use, compressed memory, missing or malformed fields, and cumulative-counter
integrity. Runtime monitoring SHALL additionally enforce swap growth and the
declared gauge hysteresis. Historical receipt reason tokens for raw-free
breaches SHALL remain readable without making them current eligibility rules.

#### Scenario: reclaimable capacity is not mistaken for exhaustion

- **GIVEN** raw-free pages are below the historical threshold while available
  memory, pressure, swap, compression, and counters are healthy
- **WHEN** the baseline and runtime evaluator process the snapshot
- **THEN** raw-free bytes remain recorded but do not create a reason or breach
  streak
- **AND** low available memory, warning or critical pressure, excessive swap or
  swap growth, excessive compression, or invalid input still fails closed

### Requirement: Independent scoped disclosures use proven equivalence reduction

Reveal discovery SHALL reduce only reversible, read-only, single-target
disclosures whose independence is proven by the exact runtime surface and an
explicit source-bound component contract. A candidate is eligible only when
its control exposes one `aria-controls` target, an `aria-expanded` boolean, a
read-only click with no URL transition, no active-modal/background coupling,
and `data-reveal-independence="source-bound-row-local"` in every before/after
surface for the candidate steps. ARIA shape and pairwise equality alone are
insufficient evidence of higher-order independence.

#### Scenario: independent disclosures are proven in both orders

- **GIVEN** two eligible disclosures `A` and `B` with disjoint controlled target
  ids
- **WHEN** the harness executes `A → B` and `B → A` from the same exact prepared
  source state
- **THEN** both paths and every row-local control revealed by either path are
  recorded
- **AND** the material semantic surfaces and canonical URL are equal in both
  orders
- **AND** only after that equality is proven may a deeper combination use the
  material union representative
- **AND** the source-bound `maxControlsPerSegment` is unchanged

#### Scenario: coupled or incomplete disclosures stay exhaustive

- **WHEN** a disclosure lacks one target id or boolean `aria-expanded`, changes
  the URL, enters a modal/background boundary, has overlapping targets, or its
  two execution orders produce unequal material surfaces
- **THEN** the branch remains an ordinary reveal branch
- **AND** no control or path is trimmed, merged, or marked inapplicable
- **AND** the production overflow guard remains fail-closed

#### Scenario: an untrusted fourth disclosure keeps the preceding triple ordinary

- **GIVEN** three reversible disclosures appear pairwise commutative but a
  fourth disclosure has no source-bound independence contract
- **WHEN** the harness considers the three-disclosure branch for reduction
- **THEN** it keeps that branch ordinary and explores the fourth disclosure
- **AND** no pairwise proof is treated as a higher-order independence proof

#### Scenario: the first terminal-candidate failure is captured without authority

- **WHEN** the exact survey configures failure-frontier capture and terminal
  candidate execution throws before its cursor advances
- **THEN** at most one complete frontier packet binds the pre-candidate branch,
  canonical candidate list, failing index and exact source/plan/selector/state/
  route identity
- **AND** the original failure is rethrown, the child remains nonzero, no
  `COMPLETE` capacity result is published, and the packet grants no resume or
  acceptance authority
- **AND** a callback or publication failure leaves no valid manifest and does
  not replace or convert the original failure

#### Scenario: a failure-frontier packet fails closed at every evidence bound

- **WHEN** the manifest or an asset is missing, duplicate, stale, foreign,
  reordered, oversized, too deep, over the asset-count or aggregate-byte bound,
  outside the packet root, symlinked, digest-drifted, partially written, or
  changed after publication
- **THEN** packet validation fails before browser launch
- **AND** neither raw content assets nor a pre-existing manifest can authorize
  replay, continuation, capacity completion or acceptance

#### Scenario: focused replay re-derives the failing candidate

- **WHEN** a valid exact-source failure-frontier packet is replayed from a fresh
  disposable database and browser boundary
- **THEN** the saved path is restored and the canonical candidate list is
  re-derived from the restored inventory
- **AND** list, index, candidate identity, representative input and action key
  must exactly match before the unchanged whole-surface boundary runs
- **AND** the final action is not executed, a serialized raw action is never
  trusted, and `REPRODUCED`, `PATH_OR_LINEAGE_DRIFT`, `NOT_REPRODUCED`, or
  `INVALID_PACKET` remains diagnostic-only
- **AND** the declared plan duration bounds global setup, servers, browser work
  and teardown through one detached process-group deadline with forced cleanup
  of surviving descendants

#### Scenario: a long survey retains bounded runner lifecycle state

- **WHEN** the monolithic survey processes candidates and replays branches for
  longer than an ordinary Playwright test
- **THEN** its browser calls execute outside active Playwright `TestInfo`
  instrumentation and do not accumulate per-call test steps
- **AND** candidate and branch traversal uses iterative cursors rather than an
  unresolved Promise chain proportional to completed work
- **AND** any periodic heap, queue, control, visited-state, or candidate sample
  is scalar-only, emitted at a fixed interval, and cannot be parsed as a
  terminal capacity result

#### Scenario: a long-running survey renews its harness session

- **WHEN** an authenticated capacity survey approaches the absolute expiry of
  the browser session cookie while reveal branches remain
- **THEN** the harness refreshes that exact actor through the verified login
  flow before reusing the session and replaces the cached cookie
- **AND** the refresh safety window is derived from the immutable survey plan's
  reveal-depth limit plus the initial navigation and inventory budget
- **AND** the replacement must remain valid beyond the bounded full-branch
  replay window; otherwise the survey fails closed
- **AND** refresh-side browser storage and API work are quiesced before the
  prepared database baseline is established or revalidated
- **AND** an absent, non-expiring, or unrefreshable session fails closed before
  target navigation without changing the product authentication lifetime or
  weakening canonical inventory comparison

#### Scenario: survey authority cannot be promoted

- **WHEN** a capacity-survey plan or result is supplied to an acceptance,
  repair, full-preflight, shard, matrix-finalization, or release gate
- **THEN** its distinct artifact kind and digest domain are rejected
- **AND** the production reveal limits remain unchanged until the completed
  survey is independently reviewed and landed in a later exact-source commit
- **AND** a failure-frontier packet or focused replay verdict is rejected by the
  same acceptance, repair, matrix, release and publication boundaries

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

The raw `RevealSurface` captured for a route or transition SHALL remain the
evidence surface, including `order`, `domOrderKey`, and its content digest.
Exact transition and action-surface bindings SHALL continue to reference those
raw before/after surfaces. Branch-budget accounting and visited-state identity
MAY use a separate material semantic projection that retains the complete
control set, non-positional control signature (`controlKey`, role, accessible
name, enabled state, href, and declared interaction effect), and relative
control order while ignoring only pure absolute `order`/`domOrderKey` shifts.
The projection SHALL NOT trim controls, transitions, or evidence.

#### Scenario: a dynamically revealed control is covered

- **WHEN** preflight proves that an action opens a menu, dialog, tab panel, or
  otherwise reveals a control that was absent from the prior inventory
- **THEN** `PREFLIGHT.json` freezes that control with one deterministic reveal
  path, the complete semantic surface reached by that path, and their digests
  before `MATRIX.json` is finalized
- **AND** the control receives its own frozen cell that replays the path before
  its one bounded target action and records the oracle observation and terminal
  verdict
- **AND** every reveal step proves the persisted database oracle is unchanged;
  a mutation-requiring transition is represented by a separately prepared
  deterministic state rather than hidden in the reveal path
- **AND** an interactive control that declares an immediate product effect is
  frozen as `mutation-required`, remains covered by the ordinary runtime
  matrix, and is never executed as reveal preparation
- **AND** the declared interaction effect is part of the frozen semantic
  surface, so effect drift fails closed before the target action
- **AND** an ambiguous reveal path or a control first observed after matrix
  finalization fails closed instead of expanding a running campaign
- **AND** an unknown, missing, reordered, renamed, or otherwise signature-
  changed control on the replayed surface fails the owning cell

#### Scenario: an unreasoned control omission fails coverage

- **WHEN** a visible interactive control has no action result and no typed
  `not-exercised` reason permitted by the campaign policy
- **THEN** the owning route/state cell is `fail` and the stop gate remains open

#### Scenario: raw positional evidence is distinct from material accounting

- **GIVEN** two raw surfaces have the same control set, non-positional
  signatures, and relative control order, but every shared control has a pure
  absolute `order`/`domOrderKey` shift
- **WHEN** the transition and visited-state records are built
- **THEN** both raw surfaces and the exact action-surface binding retain their
  distinct raw fields and digests
- **AND** the material projection is equal, so the shift does not consume a
  material branch budget or create a second visited semantic state
- **WHEN** a control is added or removed, a role/name/enabled/href/interaction-
  effect signature changes, or shared controls truly reorder
- **THEN** the material projection differs, the branch/state remains
  material and fail-closed, and no raw control or evidence is silently
  trimmed

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
changing `MATRIX.json` or its digest. The merger SHALL publish the validated
`cells` and `baseline` together through one rename of their containing canonical
directory; two independently visible publication steps are forbidden.

#### Scenario: isolated lanes replay one frozen matrix

- **WHEN** the operator requests more than one deterministic lane
- **THEN** readiness proves distinct databases with no foreign client, empty
  Redis instances with no foreign client, distinct Redis identities, service
  ports, output roots, and source-bound assignments before any reset or browser starts
- **AND** every lane runs serially against only its own resources

#### Scenario: Redis mutation requires exact operator authorization

- **WHEN** any public preparation or replay entrypoint could create, start, or
  remove a lane Redis container
- **THEN** it refuses before any Docker mutation unless
  `RUNTIME_SWEEP_REDIS_RECREATE` is exactly `true`
- **AND** every mutation consumes a freshly minted single-use authorization
  immediately before the primitive
- **AND** absent, empty, differently cased, reused, stale, or caller-fabricated
  authorization cannot reach that primitive

#### Scenario: target plans can be verified without mutation

- **WHEN** the operator verifies the configured lane count before resolving the
  integration or database/Redis execution inputs
- **THEN** separate guard-only commands derive every canonical lane database
  and Redis target, prove that each database differs from `DATABASE_URL`, and
  require the exact loopback, non-production suffix, flush, and recreation
  declarations
- **AND** both typed results declare `destructiveOperationsAllowed=false`
- **AND** the commands import no database, Redis, Docker, child-process, socket,
  or filesystem-write primitive and cannot create, start, remove, connect,
  reset, seed, or flush a resource
- **AND** an unsafe, ambiguous, production, equal-database, non-canonical, or
  incomplete target plan exits nonzero before runtime input resolution

#### Scenario: Redis identity is re-proven after every mutation and readiness wait

- **WHEN** a lane Redis container is created, started, recreated, or reused
- **THEN** every Docker mutation targets the previously inspected immutable ID,
  never a mutable name
- **AND** after the bounded readiness wait the runner inspects that exact ID and
  re-proves the complete canonical tuple, running state, and ID equality before
  returning success
- **AND** invalid creation output, name rebinding, missing inspection, foreign
  configuration, ID mismatch, or a stopped post-wait state fails closed

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
instrumentation can change focus or scroll position. Same-view transitions
SHALL compare stable landmark topology and movement. A read-only control may
mask landmark topology and movement only when immutable successful URL
artifacts prove one of these same-origin navigation boundaries: a link to a
different declared target path or redirected descendant; the canonical
form/slides link where the single `mode` query parameter changes only between
absent and `slides`; or the exact Sign out button settling at `/`. Arbitrary
href-less buttons, other query changes, duplicate or unknown modes, failed URL
artifacts, and target mismatches SHALL remain strict. Viewport, overflow,
loading, duplicate-key, malformed, and keyed zero-size checks SHALL remain
blocking on both snapshots.

Transition visual evidence schema version 2 SHALL label the comparison as
`same-view-landmarks` or `navigation-boundary-snapshots`. Existing schema
version 1 artifacts and their `same-route-landmarks` or
`cross-route-snapshots` labels SHALL remain immutable.

Run-level observability artifacts SHALL also bind the matrix digest, assignment
digest, run id, lane id, profile, run-scoped service name, and content digests
of every required raw artifact. The merger SHALL reject stale, foreign-run,
loose, symlink-substituted, digest-mismatched, or incomplete evidence before it
reads cell verdicts.

The observability adjudicator SHALL identify undeclared failures, repeated or
unbounded requests, retry storms, missing or ineffective cache behavior where
the route declares a cache expectation, slow-request outliers, queue failures,
and Bugsink/Loki events correlated to the cell time window and correlation id.
Every generated route SHALL carry either a strict machine-readable network
policy or an explicit reviewed `null` declaration. The finalized matrix SHALL
bind the effective policy into the case identity and matrix digest, and every
ordinary or specialized browser capture SHALL receive that bound policy without
a fallback. The current cache/performance claim is limited to duplicate-request
cache-contract heuristics and per-request slow outliers; it SHALL NOT be reported
as HTTP cache-header validation, a cache-hit proof, a percentile budget, or an
end-to-end SLO.
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
An HTTP response SHALL count as an HTTP error only when its status is `>=400`;
informational, successful, and normal redirection responses, including `304`
cache revalidation, SHALL NOT fail the cell. This threshold SHALL apply to
initial, action, recovery, and final-tail evidence windows.
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
- **AND** same-view geometry, overflow, loading-state replacement, and
  unexpected visual movement are adjudicated from that pair
- **AND** only a proven cross-route link, canonical form/slides mode link, or
  exact Sign out boundary may mask landmark topology and movement comparison
  while snapshot-local visual failures remain blocking

#### Scenario: exhaustive preflight diagnostics remain bounded without trimming coverage

- **WHEN** one preflight segment executes a high volume of browser calls
- **THEN** a failure retains its Playwright call/source trace, a separate full
  network HAR without response bodies, failure screenshot, video, and error
  context without per-call trace DOM snapshots or trace screenshots
- **AND** initial navigation retains DOMContentLoaded, the bounded soft
  network-idle attempt, and two-pass application readiness, while a replayed
  reveal branch retains DOMContentLoaded and the same application-readiness
  boundary without repeating the soft network-idle attempt
- **AND** live observation waiting compares the canonical DOM, control, focus,
  URL, and network state inside the browser context, captures the full canonical
  snapshot after a change signal, and never treats navigation-context loss as
  an observation
- **AND** the diagnostic policy does not remove a reveal candidate, control,
  transition, non-mutation proof, or required runtime-cell screenshot

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
