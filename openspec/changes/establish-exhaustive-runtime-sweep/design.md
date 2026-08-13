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
mid-path browser state. Canonical publication remains one complete ordered
`PREFLIGHT.json` whose state union exactly equals the frozen source plan.

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
production segment runner passes the two reveal limits from that exact source
to discovery and rejects a control-count overflow before it returns a segment
to the canary or full-preflight caller. Finalization applies the source's
control and case limits again as a second check; it never trims discovered
controls or finalized rows. `MATRIX.json` keeps only its existing two limit
fields because reveal limits govern preflight execution, not matrix shape.

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

Require a distinct, permitted non-production `E2E_DATABASE_URL` before
`prisma migrate reset`/profile seed; Prisma's destructive guard remains final
authority, with seed validation/stable IDs in the manifest. Native Codex
`gpt-5.6-luna` Max reviews emit candidates only and never mutate the ledger or
deterministic browser/database state. Codex owns scheduling, reset/reseed,
manifest, ledger, merge, adjudication, and gate; read-only verifiers may
parallelize only through explicitly imported results.

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
