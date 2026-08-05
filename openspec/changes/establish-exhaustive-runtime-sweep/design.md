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
- Give Codex one append-only ledger; bounded OpenCode DeepSeek V4 Flash Max
  browser Drivers drive roles sequentially in one browser. Native `gpt-5.6-luna`
  workers handle bounded implementation, while `gpt-5.6-sol` owns architecture,
  planning, and final synthesis.
  Parallelism is limited to read-only candidate verification and evidence review.
- Make completion a blocking verdict with zero confirmed or unresolved functional, accessibility, or visual gaps.

**Non-Goals:**

- Firefox, WebKit, mobile, tablet, responsive breakpoints, production data, or server-side CI execution.
- A frozen per-element BDD/coverage catalog, formal MBT model, or unbounded claim over arbitrary inputs/events.
- A negative-authz grid for unreachable routes; unexpected denial of a reachable route remains a finding.
- Actions against production or a shared development DB; stateful actions are only on the disposable guarded E2E DB.
- Product implementation changes, migrations, feature flags, or a second database ledger.

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

Pairwise coverage is calculated over those legal executable rows, never a raw
Cartesian crossing of every fault with every unrelated control. Every declared
axis value and legal pair is either present in an executable cell or a typed
`not-applicable` record with a stable constraint id and reason. The same frozen
inventory, declarations, profiles, and source inputs produce identical ordered
cell ids and digest. Runtime discovery drift after finalization fails the cell;
it never silently changes the matrix or trims work to a limit.

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

The Playwright project is pinned to Chromium Desktop Chrome `1440x900`, reduced
motion, one worker, and sequential role/profile drives. One browser context does
normal work; a second is only for two-context concurrency cells. Reset/reseed
the browser/database before each stateful segment or ambiguous interruption;
retain loopback bypass, dev-auth, API/web isolation, and report preservation.

Require a distinct, permitted non-production `E2E_DATABASE_URL` before
`prisma migrate reset`/profile seed; Prisma's destructive guard remains final
authority, with seed validation/stable IDs in the manifest. Bounded OpenCode
DeepSeek V4 Flash Max browser Drivers emit candidates only and never mutate the
ledger or share the browser in parallel. Codex owns scheduling, reset/reseed,
manifest, ledger,
merge, adjudication, and gate; read-only verifiers may parallelize.

The campaign records the installed OpenCode version from `opencode --version`
in immutable `SOURCE.json` rather than pinning a version in the runbook. Before
driving, the compatibility preflight checks `opencode mcp list` and the
required Playwright MCP tools. Both runtime-preflight and live runtime configs
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

Environment feedback requires `RUNTIME_SWEEP_API_LOG`,
`RUNTIME_SWEEP_BUGSINK_DSN`, `RUNTIME_SWEEP_LOKI_PUSH_URL`, and
`RUNTIME_SWEEP_LOKI_QUERY_URL`; missing or unreachable values are blind and fail
the drive closed. Loki authentication is optional only as a pair: both
`RUNTIME_SWEEP_LOKI_USERNAME` and `RUNTIME_SWEEP_LOKI_PASSWORD` are absent for
unauthenticated local Loki or both are present for authenticated Loki.

Function evidence follows the domain `Given/When/Then`; accessibility combines
axe with keyboard/focus/name/role checks. Visual evidence is settled Chromium
`1440x900`; baseline/final pass evidence is content-addressed, zero diffs are
allowed except declared reviewed masks, and all failure traces are retained.

### Before/after evidence flow

The existing flow is `reset/seed once → route walk → per-role Markdown report`,
with the AI Driver's candidates, environment feedback, and verifier output
stored separately. It cannot prove that a control/state was covered or that
reports describe one source version.

The new flow is:

1. **Freeze:** `pnpm test:runtime-source` creates a campaign SOURCE artifact
   containing the clean `HEAD` SHA/tree digest, Playwright/browser/viewport,
   environment identifiers, catalog digest, domain spec digest, profile set,
   compiled nominal plan, specialized declarations, and explicit exclusions.
   It refuses a dirty tree or SHA drift.
2. **Preflight and finalize:** `pnpm test:runtime-preflight` consumes the
   required `RUNTIME_SWEEP_SOURCE` and `RUNTIME_SWEEP_PREFLIGHT` paths, resets
   the disposable E2E database, runs each nominal route/state segment, validates
   its profile/journey, and freezes semantic control inventory into PREFLIGHT.
   `pnpm test:runtime-manifest` then requires both immutable artifacts, rechecks
   the clean HEAD/tree, and compiles final ordered executable cases, typed
   inapplicable combinations, total limits, and digest into `MATRIX.json`;
   abort before baseline work if limits are exceeded.
3. **Prepare and drive:** replay only frozen cases. Capture route-level `before`
   evidence after login and settle (URL, shallow DOM, console/network state,
   axe baseline, and visual capture). For each cell, execute one bounded
   action/fault (including an authorized
   irreversible action when declared) and capture `after` function,
   axe/keyboard, visual, console/network/API, and relevant DB/period
   assertions. Stateful cells reset/reseed and verify the DB oracle before the
   next action. Append the cell and artifact digests to the Codex-owned
   baseline ledger.
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
  database → reset/reseed at profile boundaries and after ambiguous failures;
  never resume a cell on an unverified state.
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
3. Run a pilot on one clean SHA and the dedicated E2E database. Verify that the
   manifest, canary, seed digest, cell schema, environment feedback, and
   adversarial dispositions are complete before enabling the blocking stop gate.
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
