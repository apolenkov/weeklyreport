## Context

The current Playwright sweep starts the API/web app on isolated ports, walks the
four role catalogs, and preserves one Markdown report per role before failing on
load, console, network, page, or axe anomalies. Its single-worker Desktop Chrome
project does not enumerate within-route controls/transitions, deterministic
domain states, or a shared evidence identity with the AI Driver; environment
feedback and adversarial verification remain separate reports.

The Exhaustive Runtime Sweep makes that work one reproducible campaign. The
Scenario Catalog remains a high-level behavior oracle; exhaustive coverage is
generated at runtime from the live DOM and domain oracle, not a frozen element
catalog. Domain specs are read first, and the campaign is bounded to one Git
SHA, Chromium desktop `1440x900`, and a disposable E2E database.

The design preserves the destructive database guard, canonical role-coverage
middleware builders, and period dual-state invariant (new period state and
legacy tuple together). It adds no production API or database contract.

## Goals / Non-Goals

**Goals:**

- Derive every declared `role × reachable route × runtime control/intent × deterministic state` cell from
  domain specs, the role catalog, and the live Chromium DOM.
- Cover deterministic seed profiles and a constrained pairwise matrix spanning nominal, boundary, lifecycle,
  permission, and controlled auth/network/API/concurrency/infrastructure faults.
- Exercise reversible and irreversible actions (publish, delete, revoke, restore) sequentially on the disposable
  E2E DB, resetting/reseeding and checking the database oracle after each stateful action.
- Capture function, accessibility, and visual evidence before/after each declared interaction, with every artifact
  and verdict bound to one SHA, seed/profile snapshot, role, route, viewport, and oracle.
- Keep the baseline immutable through independent adjudication; then rerun affected cells for each fix and the
  full matrix at the fix SHA.
- Give Codex one append-only ledger; deterministic Playwright projects own the
  exhaustive cell sweep. Native Codex `gpt-5.6-luna` Max reviews consume each
  canonical role/profile evidence batch sequentially, emit candidates only, and
  require an explicit verifier import before merge. `gpt-5.6-sol` owns
  architecture, planning, and final synthesis. Deterministic replay may use
  bounded parallel lanes only when every lane has exclusive database, Redis,
  API/web, browser, and archive resources and one validated merger proves exact
  full-matrix coverage. Native review parallelism remains limited to read-only
  candidate verification and evidence review.
- Make completion a blocking verdict with zero confirmed or unresolved functional, accessibility, or visual gaps.

**Non-Goals:**

- Firefox, WebKit, mobile, tablet, responsive breakpoints, production data, or server-side CI execution.
- A frozen per-element BDD/coverage catalog, formal MBT model, or unbounded claim over arbitrary inputs/events.
- A negative-authz grid for unreachable routes; unexpected denial of a reachable route remains a finding.
- Actions against production or a shared development DB; stateful actions are only on the disposable guarded E2E DB.
- User-visible product behavior changes, migrations, feature flags, or a second
  database ledger. Behavior-neutral semantic interaction metadata is permitted
  when it makes an existing immediate product effect fail closed in preflight.

## Decisions

### Two-stage executable matrix

The campaign compiler reads durable domain specs before the catalog/page,
extracts valid values/transitions (period lifecycle, submission, ownership,
health, permission), and maps each requirement to a deterministic seed
capability. A profile that cannot provide a required state is rejected; nothing
is silently invented or skipped.

The named profiles (`minimal`, `demo`, `full`, `stress`) first produce ordered
nominal route/state segments over role, reachable route, profile capability,
lifecycle, submission, ownership-density, and permission. A deterministic
Stage A freezes those inputs and the compiled nominal plan in immutable
`SOURCE.json` (without a matrix digest). The dedicated Playwright preflight
then consumes SOURCE, resets/prepares every nominal segment, and freezes its
semantic control inventory in immutable `PREFLIGHT.json`. Only then does one
execution policy finalize `MATRIX.json`: navigation/idle,
one exact control action per cell, and named fault/concurrency/infrastructure
cells at their proven applicability targets.

Preflight discovers post-transition controls before finalization. Each branch
starts from the canonical prepared segment, replays an ordered reveal path,
waits for the bounded outcome, and inventories the resulting surface. A
reachable control is frozen with its canonical path and path digest; an
ambiguous path is rejected rather than selected by timing or DOM object
identity. `MATRIX.json` carries that preparation path into the control cell,
and replay performs it before the cell's one evidence-bearing target action.
Any post-freeze control that is absent from this inventory fails the cell and
never expands the matrix during baseline or final execution.

Unconditional catalog aliases declare two distinct route values: the entry route
exercised by navigation and the exact canonical landing URL after the expected
redirect. The landing URL is source-bound and includes its query string.
Preflight first proves that the browser settled at that exact URL, then uses its
pathname as the within-route reveal boundary. It never treats an arbitrary live
redirect as the new boundary.

A resolver route is not an unconditional alias. Its result depends on prepared
domain state and request/authentication outcome, so `/reports/latest` remains an
executable resolver entry with no route-level exact landing declaration. Its
expected outcomes are state-bound and source-digest-bound: visible current,
published fallback, empty, query error, and anonymous. The resolver contract
MUST cover the minimum applicable profile and retain typed inapplicable
role-permission boundaries, including a minimal profile that lacks the route's
required capability. The larger outcome model is a separate implementation task;
the route binding MUST NOT collapse these outcomes into one static landing URL.

`empty` and `query error` are two frozen route-local specialized resolver
scenarios, not new global pairwise axes. This avoids multiplying unrelated
routes and does not reuse `forbidden`, ownership, lifecycle, or publish-only
fault semantics. `viewer-status-empty` temporarily removes every seeded viewer
group grant inside the guarded disposable database preparation transaction,
records an exact no-visible-report oracle, and is restored by the next canonical
profile reseed. `viewer-status-query-error` installs one bounded Playwright fault
for the exact `reports.latestForViewer` tRPC operation, checks the error text and
retry control, removes the fault, retries successfully, and compares mutation
sentinels before and after. Both declarations, their derived states, expected
outcomes, fault identity where applicable, and artifacts are source-bound and
flow through preflight, matrix finalization, replay, evidence, and coverage.
The existing generic publish fault runner remains publish-only.

After a failed preflight identifies one canonical state, a repair campaign
runs that exact state through the same preparation and browser segment runner
before another full preflight. The supported repair launcher validates the
canary in the same process that observed the canary child exit, rechecks the
clean source identity, and only then starts full preflight. A standalone full
launch cannot be authorized by a synthetic PASS file. The canary writes a
separate immutable artifact; it does not create a partial `PREFLIGHT.json` and
cannot satisfy full coverage. Its selector and evidence are bound to the
current clean source identity.

Full preflight may additionally persist an append-only progress journal as an
execution optimization. The journal is not a partial `PREFLIGHT.json`, does not
carry a campaign PASS, and cannot authorize matrix finalization. Every state has
an explicit started record and at most one terminal PASS record bound to the
source SHA/tree/digest, plan and assignment digests, complete state identity,
and terminal segment digest. Resume always begins from a newly verified clean
source and a recreated disposable state boundary. It may skip only exact
terminal records whose segment artifacts revalidate; a failed, ambiguous,
started-only, truncated, stale, foreign, reordered, duplicate, or digest-drifted
record is rejected or rerun from the start of that state. Resume never restores
mid-action, mid-path, or mid-browser state. Canonical publication remains one
complete ordered `PREFLIGHT.json` whose state union exactly equals the frozen
source plan.

### Terminal completed-candidate continuation

Exhaustive reveal discovery may exceed one Playwright child lifetime even when
its state boundary is valid. The only within-state continuation point is after
one complete candidate has returned a terminal result and all resulting
discovery state has been applied. A cooperative internal chunk budget is
checked only after that candidate boundary, leaving teardown headroom below the
existing 45-minute outer Playwright timeout; the timeout itself is never used
as a checkpoint boundary. A hard timeout or crash is a real failure and
terminates the current attempt. Only a successfully written CONTINUE result
may start a fresh child from the last durable checkpoint.

Each child emits one canonical, atomically durable, archive-confined
`PREFLIGHT_REVEAL_RECEIPT_CHUNK` at a terminal candidate boundary. A chunk
contains only a disjoint, nonempty terminal-candidate suffix, its predecessor
receipt/chunk heads and counts, and a reducer-derived frontier digest; it never
repeats the parent's receipt prefix. A receipt binds the predecessor, source
branch identity, deterministic candidate list/index/identity/action/input,
terminal transition, post-action inventory, surface, URL, non-mutation proof,
and exact action/branch/completed counters.
The queue, discovery map, visited map, and cursor are never trusted as a full
snapshot: the pure reducer reconstructs them from the source-bound genesis and
receipts. Preparation closures, live Page objects, and browser state are never
serialized.

The only receipt-free child result is an observation-only
`PREFLIGHT_REVEAL_BOOTSTRAP` from ordinal zero, with no grant and a zero
predecessor chain, when the initial candidate frontier is empty. It carries no
authority and cannot advance progress. The parent hydrates its immutable
genesis assets, re-derives the exact source/state/route/attempt identity,
genesis, bounds, empty candidate list, reducer state, and controls, and accepts
it only when the pure reducer independently reaches an empty frontier. The
child still authors neither COMPLETE nor PASS; only the parent may sign a
zero-chain `PREFLIGHT_REVEAL_PARENT_PASS` and write canary PASS.
An initial frontier with any eligible candidate retains the existing nonempty
receipt-chunk and parent-sealed execution-grant path; it is never reclassified
as a bootstrap observation.

On restart the parent rechecks live clean Git source and the exact campaign,
selector, source/tree/plan/state/route identity, then parses and deterministically
replays the raw child result. It requires the exact immutable receipt prefix,
strict progress, and a fresh disposable database/browser boundary. The parent
seals an accepted reducer frontier as a parent-owned
`PREFLIGHT_REVEAL_EXECUTION_GRANT` with a fresh in-memory authority tag; only
that grant may be supplied to the next child. The child replays the current
branch's canonical path from its clean route, re-derives the candidate
list/order, restores the bounded parent-derived reducer snapshot (controls,
dynamic-control registrations, visited state paths, and exact preparations),
and rejects any snapshot/frontier mismatch against the sealed reducer-state
digest before the next action. The snapshot carries no receipt history. The
child starts exactly at the next candidate and never emits
`PASS`: after reducing the suffix, the parent either seals the next execution
grant or reduces an empty frontier and alone creates the
`PREFLIGHT_REVEAL_PARENT_PASS` plus canary PASS after another live source
recheck.

Parsing validates canonical bytes, field digests, receipt semantics, source/tree,
state, route, surface, cursor/order, duplicate/missing records, and counters;
the parent reducer establishes semantic completeness. Source, tree, state,
route, surface, selector, or digest drift fails before browser work. A raw or
sealed continuation result is progress evidence only: it is neither a terminal
journal record nor a canary result and cannot authorize matrix finalization or
a full-preflight launch. This vertical slice is exact-canary-only; full and
shard journal continuation integration remains NOT-PROVEN, and canary artifacts
cannot be reused across those scopes. The launcher loops a source-derived
finite number of child chunks only while each result advances the completed
candidate ordinal and immutable predecessor chain; a repeated or missing
result fails closed. Any nonzero child exit, including a hard timeout or crash,
terminates the current attempt; only cooperative receipt chunks advance to a
new child. A new parent process starts a fresh attempt and cannot reuse the
prior in-memory authority secret.

The exact `admin/demo` canary continuation additionally requires a parent-only
file-backed host checkpoint after each accepted nonterminal child chunk. The
parent seals the reducer grant first, publishes a source/tree/state/route-bound
request, and waits exactly five seconds for the external controller to append
one healthy, normal, later host sample. Requests and responses are strict,
newline-terminated canonical JSON (16 KiB maximum, mode 0600, immutable
no-clobber publication) under a fresh mode-0700 archive-confined mailbox. The
controller keeps the existing 60-sample baseline, evaluator thresholds and
three-sample hysteresis unchanged; malformed, duplicate, gapped, stale,
breached, or non-normal observations terminate the parent without launching
the next child. The checkpoint path is removed from every Playwright/config/web
and API child environment and carries no resume authority or secret.

The external controller consumes a separate strict post-infrastructure baseline
reader rather than the pre-resource receipt reader. That reader accepts exactly
60 source/tree/campaign-bound healthy records, regular non-symlink mode-0600
manifest and payload files, canonical JSONL bytes, complete metrics, monotone
wall-clock timestamps and cumulative counters, and the unchanged evaluator
limits. It returns the exact baseline receipt digest, last sample and counters;
the response echoes that digest so the parent can identify the baseline that
fed the evaluator. Runtime responses are explicitly marked `phase: runtime`,
and both controller-observation and sample timestamps must be strictly later
than the parent request boundary. The controller is one-attempt and in-memory
only: it accepts the first request and then only the exact next sequence,
predecessor digest, receipt/chunk heads, counters and sample sequence; it never
resumes, grants, writes PASS, or persists authority. Mailbox scanning happens
before and after watcher setup, so a request arriving during setup cannot be
lost; the CLI has a bounded abort deadline and receives source authority only
from the exact runtime environment.

Every reveal-path step is a preparation activation, not a second product
action. Preflight and replay compare the exact database oracle before and after
each step and reject a path that mutates persisted state. A transition that
requires mutation belongs to a separately prepared deterministic state; it
cannot be smuggled into a control cell as preparation. Each path also freezes
the complete stable-sorted semantic surface (control identity, role, name,
enabled state, order, href, declared interaction effect, and digest), not only
the target control. A control marked `mutation-required` remains in the runtime
inventory and matrix but cannot be used as reveal preparation. Replay requires
exact equality before the target action, so an unknown, missing, or signature-
changed control is blocking discovery drift.

The frozen `RevealSurface` is the raw evidence surface: its `order` and
`domOrderKey` remain intact, its digest remains content-addressed, and every
transition/action-surface binding continues to reference those exact raw
before/after surfaces. Branch-budget accounting and visited-state identity use
a separate material semantic projection. That projection retains the complete
control set, each control's non-positional signature (key, role, accessible
name, enabled state, href, and declared interaction effect), and the relative
control order while ignoring only absolute `order`/`domOrderKey` shifts. A pure
absolute shift is therefore non-material for accounting; a new or removed
control, any non-positional drift, or a true relative reorder remains material
and fail-closed. The projection never trims raw controls, transitions, or
evidence and never changes the frozen action binding.

Pairwise coverage is calculated over those legal executable rows, never a raw
Cartesian crossing of every fault with every unrelated control. Every declared
axis value and legal pair is either present in an executable cell or a typed
`not-applicable` record with a stable constraint id and reason. The same frozen
inventory, declarations, profiles, and source inputs produce identical ordered
cell ids and digest. Runtime discovery drift after finalization fails the cell;
it never silently changes the matrix or trims work to a limit.

Source capacity is an explicit version-2 `SOURCE.json` contract. The source
digest covers independent positive limits for reveal material edges, reveal
actions, controls per preflight segment, and total finalized cases. The
production segment runner passes the three reveal limits from that exact source
to discovery and rejects a control-count overflow before it returns a segment
to the canary or full-preflight caller. Finalization applies the source's
control and case limits again as a second check; it never trims discovered
controls or finalized rows. `MATRIX.json` keeps only its existing two limit
fields because reveal limits govern preflight execution, not matrix shape.

`SOURCE.json` also has one canonical origin boundary. The existing
`buildCampaignSource`/`writeCampaignSource` path remains the only source
builder. Before a source can authorize packet construction, a host receipt,
preflight, matrix finalization, lane planning, resource preparation, replay,
coverage finalization, or AI import, a non-runtime validator rebuilds the
expected source from the same clean repository inputs and compares the exact
canonical serialization with the supplied bytes. A synthetically rehashed
manual edit is therefore rejected even when its embedded digest is internally
valid.

Only that exact comparison may publish an immutable
`SOURCE-VALIDATION.json` PASS receipt. The receipt binds the campaign, clean
SHA/tree/tree digest, source and plan digests, exact source-file digest and byte
length, and its own digest. The validator also publishes the receipt file SHA-256
to the invoking process; every later consumer requires that external value, so
changing and internally rehashing a receipt cannot create authority.
Runtime-capable entrypoints check the source and receipt before directory
creation, destructive guards, runtime/browser/server/resource child processes,
browser work, or Docker/database/Redis access. The harness-only Playwright
configuration remains exempt because it imports no live runtime authority.
Packet materialization must copy both source and receipt and repeat the same
read-only check over the copied bytes before resource initialization. Read-only
Git/tool subprocesses used to rebuild the canonical source are part of the
validator and are not runtime effects. An envelope, host receipt, or Sol gate
cannot substitute for this source-authority boundary.

Capacity calibration uses a separate diagnostic protocol rather than weakening
the acceptance runner. A `PREFLIGHT_CAPACITY_SURVEY_PLAN` binds the current
source SHA/tree/digest, one exact selector and resolved state/route, explicit
reveal graph limits, one child, a hard wall-time deadline, and per-file plus
aggregate output limits. A dedicated Playwright configuration selects only the
survey spec and disables HAR, trace, video, screenshots, and failure-retention
amplification. The server lifecycle remains owned by that configuration, while
the browser survey runs from its global setup without an active Playwright
`TestInfo`; the post-setup spec performs no browser work and checks only that a
terminal result candidate exists. This prevents the test runner from retaining
one `pw:api` step for every replay call until the full survey ends. The reveal
queue advances candidates and branches through iterative cursors rather than an
adopted Promise chain, and emits only bounded scalar heap/cardinality progress
samples at a fixed interval. Those partial samples are diagnostic logs and can
never satisfy result or acceptance authority. The survey runs one monolithic
reveal queue, so it creates no continuation checkpoint, receipt, grant, parent
PASS, assignment, journal, matrix, or canary artifact.

A failed monolithic survey may invoke one optional diagnostic-only
`onCandidateFailure` callback around terminal candidate execution. The callback
is absent by default and is never supplied by production preflight, canary,
full, shard, repair, matrix, release, or acceptance paths. It receives the
pre-candidate discovery state, current branch, canonical candidate list,
candidate index and identity, and the original thrown error before the cursor
advances. It may publish only a bounded first-failure frontier packet and must
then rethrow the original error. A capture or publication failure leaves no
valid packet and never replaces, converts, retries, or marks the original
survey failure as complete.

The failure-frontier packet has its own
`PREFLIGHT_REVEAL_FAILURE_FRONTIER` artifact kind, version and diagnostic-only
digest domain. It is published under a separate archive-confined packet root,
never as a capacity plan/result, continuation checkpoint, receipt, grant,
parent PASS, canary, journal, matrix, or release artifact. It reuses the strict
immutable content encodings for branch, path nodes, inventory, surface and
canonical candidate-list evidence, but the frontier manifest is the only
packet-completion marker and those content objects carry no execution
authority. The manifest binds source SHA/tree/tree digest/source digest, source
plan digest, capacity-plan artifact digest, selector/state/route identities,
branch/path/inventory/surface/candidate-list refs and digests, candidate index
and candidate identity, action-key digest, bounded failure classification and
the declared packet limits.

The canonical manifest is at most 64 KiB and a captured branch is at most depth 8. A packet declares positive per-file, asset-count and aggregate-byte bounds;
the parser additionally rejects more than 64 content assets, any content asset
larger than the existing 8 MiB continuation-asset ceiling, or more than 64 MiB
of aggregate manifest-plus-asset bytes. Every path is resolved under the exact
packet root and regular non-symlink files are required. Assets are written
content-addressed and read back by digest before the manifest is created
exclusively, synced and reread; the manifest is written last. Missing,
duplicate, foreign, stale, reordered, oversized, path-escaping, symlinked,
digest-drifted, partially written, or post-publication-mutated inputs invalidate
the packet before browser launch.

A focused replay accepts only a valid packet whose source and capacity-plan
identities match the live clean repository. It hydrates the recorded branch and
path, creates a fresh disposable database/browser boundary, replays the path,
derives the current canonical candidate list from the restored inventory, and
requires exact list, index, candidate-id, representative-input and action-key
equality. It then invokes the unchanged production whole-surface action
boundary for that candidate without executing the final action. Serialized raw
actions never authorize replay. An earlier restore/lineage mismatch is reported
as `PATH_OR_LINEAGE_DRIFT`; an exact final-boundary mismatch is `REPRODUCED`; a
fully matching boundary is `NOT_REPRODUCED`; identity or packet rejection is
`INVALID_PACKET`. None of those diagnostic outcomes is acceptance evidence or
satisfies the empty-frontier capacity result.

The operator entrypoint launches the focused Playwright process as a detached
process group. The exact plan duration is an outer hard deadline covering
global setup, web/API servers, browser work and teardown; expiry interrupts the
whole group and retains a bounded forced-kill escalation so a departed group
leader cannot leave server or browser descendants running.

Because this diagnostic may legitimately run longer than the product session
lifetime, its preflight session cache uses the browser cookie's absolute expiry
as the renewal authority. Before expiry enters a bounded safety window, the
harness refreshes only the selected actor through the same verified dev-login
identity flow and replaces the cached cookie. It does not duplicate or extend
the server JWT lifetime. The immutable survey plan's reveal-depth limit derives
the safety window: one minute for each possible replay action/settle step plus
one additional minute for initial navigation and inventory. Production and
acceptance paths retain their production reveal-depth default.
After a refresh, the harness clears browser storage, returns to `about:blank`,
drains API work, and only then establishes or revalidates the prepared database
baseline. Missing expiration, a replacement still inside that window, refresh
failure, identity drift, or off-route navigation fails before inventory replay;
the strict canonical surface equality remains unchanged.

Only queue exhaustion may create a `PREFLIGHT_CAPACITY_SURVEY_RESULT` with
status `COMPLETE`. The result records terminal candidate/action/material-edge/control/
visited-state/max-queue counts, exact plan/source/selector/state/route identity,
and an empty frontier, then the launcher rechecks exact live source identity.
Timeout, overflow, nonzero child exit, identity drift, or bounded-write failure
leaves no result that can be interpreted as terminal. The plan and result use
their own artifact kinds and digest domains; acceptance, repair, full, shard,
matrix, and release paths never parse them. A completed survey supports a later
reviewed source-limit change but is not acceptance evidence itself.

Independent reversible disclosures are canonicalized only after their effect is
proven rather than by raising a source limit or trimming the graph. A control is
eligible only when it is a read-only click with one `aria-controls` target, a
boolean `aria-expanded` state, no URL change, no modal/background coupling, and
the exact source-bound `data-reveal-independence="source-bound-row-local"`
contract. The contract is an explicit component-owned promise of row-local
state isolation; ARIA shape and pairwise observations alone never authorize a
reduction.
The harness retains each single-toggle branch and every row-local control it
reveals. For a pair of eligible controls it executes both `A → B` and `B → A`,
requires disjoint controlled targets and equal material surfaces/URLs, and only
then may use the material union as the canonical representative for deeper
combinations for controls carrying that source-bound contract. Coupled
controls, modal surfaces, URL-changing controls, missing ARIA scope, missing
contract, and any non-equal pair remain ordinary branches and are never
canonicalized. The reduction is therefore a source-bound equivalence proof over
already executed controls, not an inference from pairwise equality or a limit
bypass; the source-bound `maxControlsPerSegment` remains unchanged and the
proof is persisted in the same exact-source continuation state. An untrusted
fourth disclosure keeps the preceding triple ordinary even when every observed
single and pair appears commutative.

### Typed coverage cell and evidence identity

The implementation may choose JSONL or an equivalent typed store, but the
conceptual record is:

```text
CoverageCell {
  id: stable campaign-local key;
  campaign: { id, sourceSha, treeDigest, browser, viewport };
  subject: { role, catalogRoute, resolvedRoute, profile, seedDigest };
  state: { domainAxes, pairwiseSet, transition, faultMode };
  action: { intentId?, controlKey, operation, safety };
  execution: navigation | idle | control | recovery | fault |
             concurrency | infrastructure;
  faultId?: stable named declaration;
  oracle: { domainSpecRefs, function, accessibility, visual };
  evidence: {
    before: [artifactRef];
    action: [artifactRef];
    after: [artifactRef];
    observations: [observation];
  };
  verdict: pending | candidate | confirmed | pass | excluded | blocked;
  disposition?: { status: dismissed | fixed, verifierRefs, findingRef?,
                  fixSha?, rationale };
}
```

Every executable cell contains exactly one bounded action or observation. Its
declared transition equals the action transition; every non-`none` fault has a
fault id and execution declaration in that same cell. A fabricated `none`
value cannot witness a missing specialized axis value.

`artifactRef` carries a kind (DOM/URL, console/page error, failed request,
API/DB assertion, axe, keyboard trace, or screen capture), archive path, and
digest. `before`/`after` surround one bounded action or fault; the oracle names
function, accessibility, and visual outcomes without `file:line`. A cell is
complete only with all three dimensions; only a typed inapplicable combination
may carry a reviewed exclusion.

### Browser, database, and process ownership

The Playwright project is pinned to Chromium Desktop Chrome `1440x900` and
reduced motion. Each runtime lane has one worker and executes its assigned
frozen cells sequentially. Multiple lanes may run concurrently only when each
owns a distinct disposable database, Redis instance, API port, web port,
browser process, Next.js dist directory, queue prefix, log/PDF directory, and
archive subtree. One browser context does normal work; a second is only for
two-context concurrency cells. Reset/reseed the owning lane before each
stateful segment or ambiguous interruption; retain loopback bypass, dev-auth,
API/web isolation, and report preservation.

The planner assigns complete frozen groups to the least-loaded lane; role-only
or URL-only partitioning is not authoritative because those axes are uneven.
Every case id belongs to exactly one lane. The runner fails all lanes closed on
the first non-pass or infrastructure failure and terminates their full process
groups. The merger validates assignment/source digests, byte-identical source
artifacts, exclusive resources, evidence references, verdicts, and exact
full-matrix coverage in staging before publishing canonical final evidence.
The final publication renames the one validated containing directory to
`canonical`; `cells` and `baseline` never become visible through separate
publication operations.
Changing the requested lane count changes the assignment digest, not the
frozen matrix or cell identities.

The diagnostic R1 capacity benchmark selected four lanes for the 14-core,
36 GB target Mac. Four lanes merged 128/128 full-group cells in 277.63 seconds.
Five, six, and ten lanes were rejected after resource-induced failures; failed
lane orchestration waited for every sibling and left no owned process or port.

On Darwin, `vm_stat` raw-free pages remain immutable diagnostic telemetry but
are not an independent eligibility veto: inactive and speculative pages are
reclaimable capacity. Baseline eligibility therefore fails closed on available
memory, the system pressure state and free percentage, swap, compressed memory,
and cumulative-counter integrity. Runtime monitoring retains those same
signals, swap-growth checks, and gauge hysteresis. This prevents healthy page
cache use from blocking the campaign without weakening actual pressure,
reclaimable-capacity, swap, compression, or counter safeguards.

Require a distinct, permitted non-production `E2E_DATABASE_URL` before
`prisma migrate reset`/profile seed; the exact central destructive guard is the
final authority, with seed validation/stable IDs in the manifest. Native Codex
`gpt-5.6-luna` Max reviews emit candidates only and never mutate the ledger or
deterministic browser/database state. Codex owns scheduling, reset/reseed,
manifest, ledger, merge, adjudication, and gate; read-only verifiers may
parallelize only through explicitly imported results.

### Exact disposable database boundary

Every E2E/runtime destructive entrypoint passes its raw PostgreSQL URL through
one validator immediately before its first mutation-capable primitive. The
validator accepts only loopback hosts and the exact raw path
`customreport_e2e` or `customreport_e2e_lane_[a-o]_test`; it rejects encoded,
case-folded, whitespace, query, fragment, and multi-segment aliases. A separate
target-only call is used by non-mutating lane-plan/readiness checks. Destructive
calls additionally require the exact per-run consent
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'`; the historical
`ALLOW_PROD_DESTRUCTIVE` TypeScript bypass is removed. Production restore stays
on its independent shell contract.

The ordering is load-bearing:

```text
raw URL + NODE_ENV + consent
             |
             v
    exact target validator
             |
             +--> reject (no pg/Prisma/Redis/spawn)
             |
             v
       one destructive primitive
```

The same boundary is applied to central E2E setup, profile seed runners,
integration cleanup, runtime lane preparation/replay/preflight/state/control
recovery, and the reset-hard, wipe-manual-uat, and policy-backfill entrypoints.

Before an integration or database/Redis gate may resolve its destructive
execution input, two separate guard-only commands derive the complete canonical
lane target plan. The database command proves a loopback base, canonical
`*_test` lane names, and inequality with the developer `DATABASE_URL`. The Redis
command proves the exact `127.0.0.1` host, canonical lane ports, and lowercase
`true` flush/recreation declarations. Both emit typed
`destructiveOperationsAllowed=false` evidence and have no database, Redis,
Docker, process, socket, or filesystem-write capability. These commands prove
configuration safety only; live ownership/readiness remains a later mandatory
read-only check, and mutation still requires the single-use capability at the
primitive boundary.

The report metadata is fixed to `provider: native-codex`, `model:
gpt-5.6-luna`, and `reasoning: max`; no provider executable or version is
captured in `SOURCE.json`. Both runtime-preflight and live runtime configs
deliberately set `NEXT_PUBLIC_AUTH_STUB=true` only to keep anonymous login
bootstrap stable; the web proxy still requires a session cookie for protected
routes.

### Controlled fault and observation model

Named faults have deterministic setup/recovery: missing/expired/forbidden auth,
network timeout/selected 4xx/5xx, API/domain error, stale-version concurrency,
and declared infrastructure-unavailable. HTTP/network uses Playwright route
interception; concurrency uses two contexts and the real optimistic path;
infrastructure uses only existing test seams, never a production hook. Scope and
tear down each injector; its failure is infrastructure, never product pass.
An expected fault is an exact declaration of operation, method, status or
transport failure, and count. Only the matching event is excluded from the
unexpected-error total. A second HTTP response, transport failure, or server
error remains blocking. Request grouping uses method plus URL pathname so a
changing query payload cannot hide a retry storm.
HTTP response semantics use the same fail-closed threshold in every evidence
window: status `>=400` is an unexpected HTTP error, while informational,
successful, and normal redirection responses, including `304` cache
revalidation, are not HTTP errors. This threshold also governs recovery.

Browser observability delivery has one narrower non-product exception. A Sentry
envelope request aborted by Chromium during document navigation remains in the
raw ledger but is excluded from the unexpected-failure count only when its
method, resource type, failure text, origin, numeric project path, public key,
protocol version, and browser-capable SDK client all match the configured
Bugsink DSN and the explicit `sentry.javascript.browser/` or
`sentry.javascript.nextjs/` signature allowlist. The collector retains the
absolute URL so the adjudicator can prove that identity, and the exception
applies only when the same ledger also contains the successful HTTP response
with the same immutable, collector-assigned request id. A response for another
request cannot qualify.
The evidence message records the ignored count. A missing or failed matching
response, empty marker, or near miss, including a product API abort, remains
blocking. The same policy applies to initial, action, recovery, and final-tail
windows.

Environment feedback requires `RUNTIME_SWEEP_API_LOG`,
`RUNTIME_SWEEP_BUGSINK_DSN`, `RUNTIME_SWEEP_BUGSINK_API_TOKEN`,
`RUNTIME_SWEEP_LOKI_PUSH_URL`, and `RUNTIME_SWEEP_LOKI_QUERY_URL`; missing or
unreachable values are blind and fail the drive closed. Bugsink requires both
credentials, a 40-character lowercase-hex API token, and its dedicated
`runtime-sweep` project. The harness is sequential and assumes no other
writers use that project while counters are polled; this is not a generic
concurrent liveness proof. The direct Sentry-protocol probe proves the endpoint;
a separate API canary initialized through `@sentry/nestjs` and a browser canary
initialized through the web application's installed `@sentry/browser`
dependency must both flush and appear in that project before the product
telemetry channel is live. The canonical DSN is supplied to both `SENTRY_DSN`
and `NEXT_PUBLIC_SENTRY_DSN`. An SDK DSN parse warning, rejected flush, or
absent tagged event is blind even when the direct protocol probe passes. Loki authentication is optional only as a pair: both
`RUNTIME_SWEEP_LOKI_USERNAME` and `RUNTIME_SWEEP_LOKI_PASSWORD` are absent for
unauthenticated local Loki or both are present for authenticated Loki.

Every completed lane/profile writes one immutable observability report. It
compares the exact local `correlationId × level` counts in the canonical
`app.log` window with an aggregated Loki query for the lane/profile service
name; malformed local lines, missing counts, or extra Loki counts fail the
profile. The dedicated Bugsink project is shared by the bounded parallel lanes,
so one run-level artifact snapshots its digested/stored counters after the live
probe and again after every lane process exits. Any counter delta fails the
entire assignment. The merger requires all profile reports, live readiness,
and the zero-delta Bugsink artifact before it reads cell verdicts.
The merger does not trust the counts copied into a profile report. It re-reads
the canonical local logs and performs a fresh bounded Loki count and shutdown-
marker query for the identity-bound service and profile window. Declared local
counts, declared Loki counts, and live Loki counts must match exactly.

For recovery-backed controls, the visual transition pair is `before -> action
result`. The action screenshot, geometry, DOM and logs are complete before
reset/reseed starts. The later `after` phase is post-recovery baseline evidence
and is not substituted for the product action result in visual adjudication.

The parent creates one immutable run identity before starting any lane. The
identity binds source SHA, matrix digest, assignment digest, run UUID, lane ids,
and profiles. Each profile uses a run-scoped service name. Each lane then writes
a completion manifest with content digests for its strict readiness/profile
artifacts; the merger reads files without following symlinks and rejects stale,
foreign-run, loose, digest-mismatched, or incomplete evidence.

The cell binding is compositional and keeps the full sweep tractable. Each
phase first binds browser responses to API/worker records by correlation id
inside the phase window. A bounded clock-skew allowance applies only to an
exact response correlation id. An unmatched warning or error belongs to a cell
only when its timestamp is inside the strict phase interval; unmatched events
outside every strict cell interval remain in the immutable profile-wide
canonical API log and block the campaign until dispositioned. The event ledger remains
attached until tracked API requests settle, and file-log collection polls for
late correlated writes before closing that window. The profile query then
batches those correlation ids over the enclosing profile window and requires
exact `correlationId × level` counts in Loki; batching does not remove the
per-cell correlation key or the profile-wide canonical API log. Bugsink has no
passing product event to assign to a cell: the dedicated-project counter must
remain at zero for the complete assignment. Any non-canary Bugsink delta blocks
all cells before merge.

A stateful control has two evidence windows. The action-attempt window ends
after the bounded functional outcome and before destructive recovery starts.
Reset, reseed, login, route reload, and state-oracle checks write a separate
recovery window. A recovery failure still blocks the campaign, but its requests
and logs are never relabelled as evidence that the product action itself failed.
For confirmation-backed submission, opening the dialog is not the functional
outcome. The executor must locate `Confirm submission` by its accessibility
contract, activate the scoped `Submit` control, and observe the mutation before
recovery starts.

API shutdown is one awaited sequence. It attempts app close, the process-wide
file-log barrier and flush, OpenTelemetry shutdown, and Sentry close with
bounded per-step deadlines; a timeout in one step does not skip the remaining
drains. Only the API process may then create the immutable profile completion
artifact, using an identity-bound contract supplied before boot. Any drain or
completion-write failure exits non-zero and leaves no valid completion. The
merger additionally requires completion time to follow the actual local
barrier record and remain inside the profile window.

The shutdown coordinator is the sole owner of `SIGTERM` and `SIGINT`. Nest does
not install a parallel signal hook; racing termination signals reuse one
shutdown promise and produce one application close and one process exit.

The browser uses one event collector and one advancing cursor from initial
navigation through before, action, after, and a final tail. Each phase consumes
exactly the records between the prior cursor and its atomic current end. The
collector waits for tracked requests that span a phase boundary; after the last
phase it drains once more, attaches late events to after evidence, and detaches
in `finally`. A late console/page/transport/HTTP failure makes the cell non-pass.

Function evidence follows the domain `Given/When/Then`; accessibility combines
axe with keyboard/focus/name/role checks. Visual evidence is settled Chromium
`1440x900`; baseline/final pass evidence is content-addressed, zero diffs are
allowed except declared reviewed masks, and all failure traces are retained.
Screenshot and geometry freeze the same boundary before keyboard or axe
instrumentation. Stable landmark topology and movement remain strict within a
view. Topology comparison is masked only for one of three URL-proven,
same-origin, read-only navigation boundaries: a link to a different declared
path or redirected descendant; the canonical form/slides mode link where the
single `mode` parameter changes only between absent and `slides`; or the exact
Sign out button settling at `/`. An arbitrary href-less button, query change,
duplicate/unknown mode, failed URL, or target mismatch remains strict. Every
snapshot-local visual oracle remains blocking.

Transition visual evidence version 2 records `same-view-landmarks` or
`navigation-boundary-snapshots` so a canonical form/slides query boundary is
never mislabeled as a cross-route comparison. Version 1 artifacts retain their
original `same-route-landmarks` and `cross-route-snapshots` values and remain
immutable.

### Before/after evidence flow

The existing flow is `reset/seed once → route walk → per-role Markdown report`,
with native AI review candidates, environment feedback, and verifier output
stored separately. It cannot prove that a control/state was covered or that
reports describe one source version.

The new flow is:

1. **Freeze:** `pnpm test:runtime-source` creates a campaign SOURCE artifact
   containing the clean `HEAD` SHA/tree digest, Playwright/browser/viewport,
   environment identifiers, catalog digest, domain spec digest, profile set,
   compiled nominal plan, specialized declarations, and explicit exclusions.
   It refuses a dirty tree or SHA drift.
2. **Preflight and finalize:** every operator declares
   `RUNTIME_SWEEP_CAMPAIGN_KIND`. An initial baseline may proceed directly;
   after a failure, `pnpm test:runtime-preflight-repair` must run and validate
   the exact failed state at the current clean SHA in the same launcher process
   before it starts another full preflight. `pnpm test:runtime-preflight`
   handles initial campaigns and consumes the
   required `RUNTIME_SWEEP_SOURCE` and `RUNTIME_SWEEP_PREFLIGHT` paths, resets
   the disposable E2E database, runs each nominal route/state segment, validates
   its profile/journey, and freezes semantic control inventory into PREFLIGHT.
   `pnpm test:runtime-manifest` then requires both immutable artifacts, rechecks
   the clean HEAD/tree, and compiles final ordered executable cases, typed
   inapplicable combinations, total limits, and digest into `MATRIX.json`;
   abort before baseline work if limits are exceeded.
3. **Prepare and drive:** replay only frozen cases. A source-bound assignment
   distributes complete groups across the requested isolated lanes without
   changing matrix order or cell identity. Each lane captures route-level
   `before` evidence after login and settle (URL, shallow DOM, console/network
   state, axe baseline, and visual capture). For each cell, execute one bounded
   action/fault (including an authorized irreversible action when declared)
   and capture `after` function, axe/keyboard, visual, console/network/API, and
   relevant DB/period assertions. Stateful cells reset/reseed only their owning
   database and verify its oracle before the next action. The validated merger
   stages and publishes the exact union of lane cells and artifact digests to
   the Codex-owned baseline ledger.

   Runtime preparation reuse is narrower than lane grouping. Navigation, idle,
   and read-only controls with `fault=none` may share one prepared state only
   when their complete preparation key is equal. Every such cell still receives
   a browser quiescence boundary, a tracked API-work drain, auth/storage setup, navigation, action,
   oracle, and evidence record. Mutating, recovery, specialized, and unknown
   executions stay isolated. A failed cell stops the reuse group immediately.

4. **Collect and verify:** correlate browser, API, Bugsink/Loki, and other
   environment channels with the Driver timeline. A blind/unreachable channel
   is recorded as blind, not clean. Read-only verifiers try to refute every
   candidate and return a disposition with evidence references.
5. **Adjudicate:** complete every candidate and every cell before changing
   product or test code. Dismissals retain their rationale; confirmed findings
   receive a finding record and fix plan. The baseline ledger and artifacts are
   immutable.
6. **Fix and resweep:** apply approved fixes at a new SHA, rerun every affected
   cell from a reset/reseed, then run the entire declared matrix. Link final
   evidence to the baseline without overwriting it; a SHA change starts a new
   manifest/ledger segment.

### Canonical archive and stop gate

Campaign artifacts live outside curated `docs/`, under
`~/work/customreport-archive/<campaign-id>/` (with the archive `INDEX.md`
updated). At minimum the archive contains:

- `MANIFEST.json` with SHA/tree/environment/profile/matrix/exclusion inputs and
  a digest reference to the frozen `MATRIX.json` executable cases;
- immutable `baseline/coverage-cells.jsonl`, `baseline/ledger.jsonl`, and
  per-cell content-addressed evidence (traces, screenshots, DOM/axe,
  network/API and DB proofs); retain every failure trace;
- driver timelines/reports, environment-channel collection, candidate records,
  independent verifier results, and `adjudications.jsonl`;
- `final/coverage-cells.jsonl`, `final/ledger.jsonl`, checksums, and a concise
  `REPORT.md`/`HANDOFF.md` describing the verdict, reruns, exclusions, and
  unavailable checks.

The gate passes only when every declared final cell is `pass`, the canary and
required evidence channels are live, the four canonical roles and all declared
routes are accounted for, and no candidate, unresolved, blocked, or confirmed
functional/accessibility/visual gap remains. `dismissed` is a disposition for a
candidate finding, not a passing cell. `excluded` is permitted only for an
owner-declared engine/viewport exclusion or a typed matrix combination proven
inapplicable; a reachable control or action—including an irreversible one—may
never be excluded. A `fixed` baseline finding counts only after its affected
cells and the full final matrix pass at the fix SHA. Excluded engines/viewports
and inapplicable combinations are listed in the manifest and are not presented
as covered.

### Load-bearing invariants

- **Destructive guard:** reset/seed commands are allowed only for the dedicated
  non-production E2E database and retain the existing guard and consent path.
- **Role coverage:** routes stay catalog-reachable and backend procedures stay
  on one of the eight canonical middleware-chain builders; the sweep does not
  create a denial matrix or hand-roll authorization.
- **Period dual-state:** any lifecycle/concurrency cell that observes or writes
  a report asserts the new period state and legacy period tuple together; the
  sweep never blesses a state where only one representation changed.

## Risks / Trade-offs

- **[Matrix growth]** Pairwise coverage across four profiles, roles, routes,
  controls, and faults can still be large → finalize legal executable cases
  after preflight, enforce limits over the total case set before baseline, and
  reject duplicate-equivalent cells. Limits abort; they never trim coverage.
- **[Dynamic DOM drift]** Runtime control keys can change between runs → derive
  stable semantic keys from role/name/route/intent and retain the raw DOM
  artifact; never use source line numbers as identity.
- **[Shared-state flakiness]** Sequential drivers can leave a dirty session or
  database → give every concurrent lane exclusive state, reset/reseed at
  profile boundaries and after ambiguous failures, and never resume a cell on
  an unverified state. More workers against one seeded database are forbidden.
- **[Preflight request overlap]** A previous state page can keep API reads alive
  while the next state mutates the database → clear origin storage, quiesce
  the page, and require the runtime API idle acknowledgement before every state
  mutation. A client abort stays owned until its tracked tRPC operation settles;
  an untracked abort makes the bounded drain fail closed. Reseed only when the state group
  changes; when authentication revisits the app after a reseed, clear origin
  storage again before preparing the state.
- **[Resource saturation]** Extra lanes can exhaust CPU, memory, PostgreSQL
  connections, ports, or file descriptors → cap API pools, benchmark increasing
  lane counts with full-group canaries, and select the fastest stable count
  rather than assuming linear scaling.
- **[False positives]** AI observations and visual diffs can over-report → keep
  domain specs as the oracle, require compact evidence, and use independent
  read-only adversarial verification before a finding is confirmed.
- **[Blind telemetry]** Empty console/API/Loki/Bugsink channels can look clean
  → require the canary and channel liveness fields; blind is a blocking state.
- **[Fault injector damage]** A network/API/concurrency seam may affect another
  cell → scope and tear down injectors per cell, verify the reset afterward, and
  classify leaked effects as infrastructure failure.
- **[Evidence volume]** Screenshots and traces are expensive to retain → store
  content-addressed, compressed artifacts with per-cell digests and keep the
  canonical ledger small.
- **[Preflight diagnostic amplification]** One exhaustive segment can issue tens
  of thousands of Playwright calls before it produces a terminal artifact →
  retain the failed preflight call/source trace, a separate full network HAR
  without response bodies, failure screenshot, video, and error context, but
  disable per-call trace DOM snapshots and trace screenshots. Playwright couples
  trace network recording to DOM snapshots, so the separate HAR preserves
  network evidence without restoring the amplified DOM/resource payload. This
  changes diagnostic encoding only; it does not reduce the reveal graph, frozen
  controls, transitions, or required per-cell visual evidence. Initial route
  navigation retains DOMContentLoaded, the bounded soft network-idle attempt,
  and two-pass application readiness. Replayed reveal branches retain
  DOMContentLoaded and the same two-pass application readiness but omit the
  redundant soft network-idle attempt. Live observation waiting performs the
  canonical DOM, control, focus, URL, and network comparison inside the browser
  context and crosses the Playwright protocol only after a change signal; the
  terminal classification still uses a full canonical snapshot, and a destroyed
  navigation context cannot itself produce a passing observation. These
  scheduling and transport changes preserve the same reveal candidates,
  transitions, controls, non-mutation proofs, and runtime-cell evidence.
- **[Environment variance]** Fonts, browser binaries, or local services can
  alter visual output → pin the browser/package lock and record environment
  fingerprints; do not silently widen the visual tolerance.
- **[Stateful action fallout]** Publish/delete/revoke/restore can leave the
  shared E2E database in an unexpected state → run them sequentially, reset and
  reseed before the next stateful segment, and assert the database/period oracle
  before and after each action.

Failure and recovery are evidence-producing paths, not implicit retries. A
missing E2E URL, guard rejection, seed/profile validation error, SHA drift, lost
canary, blind channel, or unavailable verifier aborts the gate and preserves the
partial archive. A browser/Driver crash causes a timeline/report flush, a
reset/reseed, and a restart of the affected bounded segment; partial state is
never merged with a later state. A fault injector that cannot be proven scoped
invalidates that cell and requires a clean rerun. No fix is applied during
baseline collection or candidate adjudication.

## Migration Plan

1. Add the exhaustive-runtime-sweep artifacts and typed ledger writer under
   `e2e/sweep/`, reusing the existing catalog parser, dev-auth, report
   preservation, and loopback-safe Playwright setup. Pin the project viewport to
   `1440x900` and keep the existing Layer-1 catalog sweep runnable.
2. Add domain-spec/matrix discovery, profile reset/validation hooks, controlled
   fault seams, and function/a11y/visual evidence adapters. Add only the
   campaign command and archive plumbing; do not alter product routes or API
   middleware.
3. Run a pilot on one clean SHA and dedicated E2E databases. Verify the
   manifest, one-cell and full-group lane canaries, resource exclusivity,
   assignment/merge digests, seed digest, cell schema, environment feedback,
   and adversarial dispositions before enabling the blocking stop gate. Increase
   lane count only while measured total throughput improves without instability.
4. Execute the immutable baseline, adjudicate all candidates, apply approved
   fixes, and run affected cells followed by the full final matrix at the fix
   SHA. Publish the archive report and update the durable capability specs.

There is no production migration or rollback data operation. If the new runner
is unavailable, stop it, retain the partial archive, and fall back to the
existing `test:uat`/integration checks while the harness is repaired. Never
point a recovery reset at `DATABASE_URL`; a failed campaign is not a reason to
relax the destructive guard or the final gate.

## Open Questions

None. The first implementation uses the two-stage executable nine-axis matrix,
maps each route to every profile that supplies its required capability, freezes
live control applicability before baseline, uses `stress` to repeat capable
routes at volume, uses Playwright route interception plus real two-context
stale-version concurrency, limits infrastructure faults to proven existing test
seams, and applies the fixed `1440x900` visual baseline with zero unreviewed
diffs (declared masks only).
