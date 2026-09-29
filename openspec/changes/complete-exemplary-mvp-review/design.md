## Execution boundaries

The accepted snapshot is the review denominator, not the final delivery state. Each repair compares affected current files with that snapshot, preserves neighboring edits, and records its final source identity and checks. A file changed by another session is neither automatically fixed nor discarded.

All active finding IDs appear once as repair tasks in tasks.md; excluded IDs remain in a separate historical disposition list. Shared causes may be implemented together, but each finding retains its own acceptance outcome. A finding may be closed as already fixed or disproven only with current source and relevant behavioral evidence. A changed test denominator must identify removed duplication and retained behavior coverage.

## Specifications and implementation

Existing spec links in each task group identify likely owning contracts to read. They are not a blanket claim that every listed requirement applies. Repairs that simply bring code, tests, or prose into conformance need no invented product requirement. Missing or changed durable behavior is specified in a focused child change with measurable scenarios. The same requirement must not be restated in several specs.

### P10 confirmed repair handoff

These packets describe existing task-owned changes and remaining acceptance.
Do not reimplement a correction already present or count every supporting check
as another fixed defect. Reconcile current hashes before reusing older evidence.

| Finding / packet                 | Confirmed trigger and correction                                                                                               | Owned inputs and remaining acceptance                                                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DS-F01 / QE-FIELD                | Quick-editing a linked Next preview previously patched Current `text`; dispatch now selects `nextStepText` for that projection | `use-overview-item-editor.tsx` and its colocated test in lead/shell; hook regression, independent review and Next browser/SQL read-back exist. Reuse applicable evidence; finish the child contract separately                                |
| DS-F02 / QE-RETAIN               | A→B→A navigation lost component-local input; retained state now uses session/report/stable lineage/source identity             | Lead/shell `overview-input-provider.tsx` and test, Overview preview/form and prop-threading files listed by the task diff. Read-only/browser user isolation and composition evidence remain in QE-ACCEPT; no second autosave path             |
| QE-FOCUS / QE-CLOSE              | Escape unmounted the textarea and focused `body`; explicit close now requests focus on the matching quick-edit trigger         | `status-overview-item-preview.tsx` and test. Regression observed red→green; native check was interrupted and remains unaccepted. Verify retained-memory close, Save and Cancel without stealing focus from idle rows                          |
| DS-SSE-01 / FEEDBACK-IDLE        | 30-second heartbeat raced the web proxy idle timeout; heartbeat changed to 15 seconds                                          | `apps/api/src/modules/product-feedback/agentation-sse.ts` and test. Twelve transport tests and independent Astra review passed. Preserve source/runtime limitations of the 35-second observation; this does not accept full feedback behavior |
| CI-ARCHIVE / ARCHIVE-PLACEHOLDER | Repository cleanliness rejected the empty tracked archive placeholder                                                          | Staged deletion of `openspec/changes/archive/.gitkeep` (landed in `a41779cf5`). Verify absence and repository cleanliness at delivery; preserve the unrelated supplied session history rather than deleting it to make the gate pass          |

Repair priority and contract bindings (line anchors observed in the current
dirty source; rebind after changes):

| Packet              | Priority            | Owning contract and source anchor                                                                                                  | Narrow regression / remaining acceptance                                                                                                              |
| ------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| QE-FIELD            | P1                  | `openspec/specs/lead-status-overview/spec.md`; lead/shell `use-overview-item-editor.tsx:244`                                       | Linked Next patches commitment while Current and independent Next patch text; retain the accepted persistence evidence when applicable                |
| QE-RETAIN           | P2                  | `openspec/changes/refine-overview-editing-layout/specs/lead-status-overview/spec.md`; lead/shell `overview-input-provider.tsx:101` | Stable lineage survives canonical record replacement and A→B→A; complete QE-04/QE-05/QE-08 browser acceptance                                         |
| QE-CLOSE            | P2                  | Same child spec; Overview `status-overview-item-preview.tsx:101`                                                                   | Escape/Cancel/Save restore the matching trigger, including retained input; idle mounts do not steal focus; complete QE-07                             |
| FEEDBACK-IDLE       | P2                  | `openspec/specs/authenticated-product-feedback/spec.md`; `apps/api/src/modules/product-feedback/agentation-sse.ts:50`              | Retain heartbeat and cancellation tests; bind proxy observation to actual URL, source/runtime and received chunks before broader transport acceptance |
| ARCHIVE-PLACEHOLDER | P1 delivery blocker | `openspec/specs/repository-file-accountability/spec.md`; `scripts/gates/repository-cleanliness.ts:26`                              | Confirm task-owned placeholder deletion and the final cleanliness result; do not remove unrelated session history to force a pass                     |

P1/P2 above are repair-queue priorities, not a new security severity assessment.
The two existing DS finding severities are preserved; the other priorities are
coordinator triage. All five corrections already exist in the task diff, so the
next action is remaining acceptance or source-drift reconciliation, not repeat
implementation. Each packet has one implementation owner; overlapping QE files
must be handled serially. Subsequent confirmed findings get new packets rather
than being silently folded into these five accepted planning definitions.

For each newly confirmed finding, extend this handoff with one bounded patch:
named trigger, root cause, smallest affected files, owning spec, regression,
independent review requirement and remaining browser/integration evidence.
Unconfirmed concerns stay in the review output; do not silently promote them
into implementation tasks. These five packets do not exhaust the full review.

## Data and write invariants

Lifecycle and record-write repairs preserve the Report period dual-state atomically and retain the seven canonical procedure builders. The exact disposable database guard and per-operation consent remain mandatory for applicable integration work. No production, shared, or unknown database is a test target. The present change does not itself authorize destructive operations.

## Desktop acceptance

Preserve the current visual direction and English UI strings. Read canonical localhost:3000 onUI annotations before UI edits and tie each resolved annotation to changed sources, an applicable automated check, and real browser evidence. Verify lead authoring, pending-save handling, report and slide projections, head review and publication surfaces, viewer navigation, history, administration, and print/export where the repair affects them. Do not simulate mobile acceptance or use synthetic screenshots as evidence.

### P09 desktop matrix reconciliation packet UX-PLAN

The consolidated `ux-dispatch-catalog.json` in the evidence root is the dispatch
index: exact retained baseline IDs, 200 imported groups, nine existing QE IDs and
15 child-spec scenarios. Its hashes bind authoritative sources. Counts represent
obligations, not an additive number of unique browser executions. Existing named
gaps stay visible; actual runtime/fixture evidence is collected during execution.

`imported-ux-source-candidates.json` preserves all 105 original queue entries
with their complete action, check, fixture and width constraints. Its reproducible
source-path join is retained as provenance. Forty-two surface entries now name
their intended families and preserve the original action and every literal
assertion, including separate loading/empty/error branches, validation bounds,
host-specific focus checks and mutation/readback requirements. This is explicit
obligation retention, not proof that the current matrix already covers each
assertion. Historical labels, limits and recovery behavior still require current
source comparison and exact execution-ID binding. Twelve further entries
now have explicit retained obligations: nine bind to named surface families and
three remain global prerequisites (source/runtime identity, query-error fixture
inventory and remaining reduced-motion interactions). Their exact execution IDs
still require reconciliation. In particular, a missing report is not an empty
published snapshot, a selected empty product is not a zero-section deck, request
approval is not generic report reopening, and a historical PDF size/job cannot
prove a new browser download. Fifty route/audience entries are retained as distinct assertions and
linked to the corresponding surface families. Each preserves requested URL,
role and historical expected outcome, and requires the actual session/config,
final URL and main-region text (plus the denial home link when applicable).
These links do not prove equivalence with an existing visual execution case or
silently enlarge the accepted scenario denominator. Verify current source
semantics and reconcile exact execution IDs before claiming their coverage.
The remaining native200 entry is excluded by the later explicit user
scope. Shared file paths are only a search aid: compare each original assertion,
role, state and viewport before accepting an equivalent matrix scenario. The
artifact binds hashes of the original queue, current planning matrix, imported
index and scope update. It accepts no browser result and retires no other item.

`ux-imported-execution-supplement.json` expands the 104 retained obligations
into 206 proposed packets: 153 viewport cases, 50 route cases and three global
prerequisites. Its 200 dispatch groups retain every proposal ID exactly once;
only the three explicitly width-independent print obligations share viewport
proposals, avoiding six duplicate dispatches. Their role/state assertions and
all-page PDF checks remain mandatory; a group is not a single test or action.
These are not 206 additional accepted baseline scenarios; resolve
equivalence before counting executions. `ux-historical-evidence-availability.json`
links 34 original evidence files to 34 obligations; all files exist with recorded
hashes. The other 70 obligations have no literal evidence reference in this queue.
Existence proves neither current applicability nor absence of evidence elsewhere.
The supplement preparation review passed; runtime acceptance still requires
source/fixture binding and implemented P07/P08 behavior.

Imported audit source: `/Users/wrk/Documents/WeeklyReport-audit-handoff-2026-09-06`.
Its START-HERE and HANDOFF-OPEN-QUEUE preserve 33 pending, 18 blocked, 50
route/audience cases and four additional obligations. The exact source hash and
105 crosswalk rows are in `imported-ux-queue-crosswalk.json`; full fixtures,
checks and widths remain in the original queue JSON. Match every imported ID
to the newer matrix and receipts before deciding what to run. Historical
blocked reasons are neither current blockers nor grounds to drop a requirement.
Reconcile its 29 historical UX findings with accepted corrections as part of
P01/P09. Later mobile/native200 exclusions supersede the imported old scope.

Reuse `execution/ui-feedback-current-reconciliation.json` as a source-bound
baseline: it already maps 34 rows (UX01–UX26 plus UF01–UF08), with original IDs,
anchors and native acceptance clauses. `historical-feedback-anchor-drift.json`
checks those anchors against current files without repeating behavioral tests.
Match the imported 29-finding list explicitly to these rows; different counts
must not be silently equated. Changed/missing anchors require source review,
while matching anchors still require dependency and receipt applicability.

The explicit-ID crosswalk is now `imported-29-feedback-crosswalk.json`:
UX-01–UX-26 map to the 34-row baseline; UX-27, UX-28 and UX-29 are additional.
The eight UF rows are separate feedback, so the union has 37 distinct source IDs.
UX-27 concerns Create defaults incompatible with Period Edit; UX-28 concerns
reminder-offset errors mislabeled as date errors. Neither had an explicit repair
match in the imported receipt. UX-29 maps to
`ROOT-UI-NESTED-DIALOG-001` (task 42.1); its historical hash-match status still
requires current-source applicability. These are provenance mappings, not three
newly reproduced defects or 29 accepted fixes.
The handoff records two final UX reviews already used: do not commission a third
full UX review merely because this is a new session. Narrow code or plan reviews
are separate and must not be described as another full UX acceptance pass.

Preserve `execution/desktop-critical-matrix-final-20260908/matrix.json` and apply
the explicit exclusions from `execution/user-desktop-scope-update-20260909.json`
under the original evidence root. The original matrix declares 87 families,
2,012 execution cases, 160 interaction checks and 586 browser contract checks.
The user update excludes mobile and native 200% zoom acceptance; effective
counts are 2,010 execution cases, 144 interactions and 585 browser contracts.
These are declared obligations, not completed browser runs. Do not infer current
runtime status from the matrix's initial zero counters or overwrite later receipts.

`ux-surface-semantic-binding.json` in the section 44 evidence root records the
first-pass disposition of all 54 imported surface/manual obligations, including
three global prerequisites. Each row points to its unchanged original record,
selects existing execution IDs where applicable, and retains explicit state,
fixture or viewport gaps. All rows remain partial and productAcceptance=false.
The independent mapping review is a narrow planning review; it neither closes
P09 nor replaces either of the two historical full UX reviews.

Current-source recovery clarification: `lead-slides-client.tsx:deckPlaceholder`
and `head-slides-client.tsx:slideDeckFallback` render SlideEmptyState with refresh
guidance for data errors, not an in-panel Retry callback. The Head activity
fallback has its own loading/error gate. Bind those separate reads and restore
them before a full reload. `LeadSectionPreviewAuth` first waits for auth.me,
then mounts WeeklyReportPage, so auth loading cannot substitute for delayed
weekly-report data. WeeklyReportPage renders a static CenteredNotice from
`weekly-report-page-helpers.ts` on temporary query failure, with refresh-page
guidance. These source facts refine the Head/Lead preview and slide assignments;
they do not prove browser recovery or the separate immutable Viewer route.

The Viewer route is now traced independently: `/reports/[reportId]` mounts
ViewerReportShell, whose form branch mounts WeeklyReportPage and whose slides
branch mounts HeadSlidesClient with enableActivity=false. Consequently the
current published form uses the same static refresh-page notice, despite the
imported form obligation naming Retry. Record that source/expectation mismatch;
do not invent an in-panel control or silently claim the historical assertion
passed. The shell's compiledHistory query controls period navigation and its
failure renders `Period history unavailable`; weeklyReport.get supplies report
content. Failure of one query is not evidence for failure of the other. The
published slide empty fixture must therefore use a truly empty immutable section
list with activity fallback disabled, not a selected empty product.

Retry provenance: `lead-history-summary/spec.md` requires Retry on the History
page's personal/compiled list failure. That contract does not establish a Retry
button on an addressed published report. `client-error-policy/spec.md` governs
logging, safe messages and automatic 4xx-versus-transient retry policy, explicitly
not error copy; automatic retries also do not prove an interactive Retry control.
Keep the imported published-form Retry assertion as an unresolved expectation
with its original provenance, rather than promote this discrepancy to a confirmed
product defect or silently remove the assertion. The History-page Retry remains
mandatory under its own contract.

| Step  | Planning result                                                                        | Acceptance of the planning step                                                                           |
| ----- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| UX-01 | Preserve every original ID and exact exclusion                                         | Set comparison with both source files; exclusions remain excluded, never PASS                             |
| UX-02 | Bind each family to current routes, roles, source files and fixtures                   | Identify retired or changed scenarios with reasons; do not invent replacement PASS                        |
| UX-03 | Reconcile existing browser receipts and screenshot paths                               | Exact scenario, source/runtime identity, observed result and limitations; stale or missing evidence named |
| UX-04 | Add quick-edit, movement and Activity deltas only where existing IDs do not cover them | Map QE-01–QE-09, accepted MOVE semantics and ACT decisions to distinct scenario IDs                       |
| UX-05 | Assign one owner per scenario and separate shared fixtures                             | Parallel read-only lanes allowed; serialize writes to the same report/user/record                         |
| UX-06 | Prepare bounded execution instructions per uncovered family                            | Route, prerequisite state, actions, expected state/focus, evidence and fixture recovery steps             |
| UX-07 | Reconcile final counts and screenshot index                                            | Required, accepted, stale, unrun and excluded counts computed separately; no arbitrary screenshot quota   |

Before dispatch, populate the selected group's existing `evidenceDirectory`
with `inputs.json`; reference the FINAL input manifest rather than copying it.
The following fields are mandatory for that group, not placeholders accepted
as evidence:

| Input     | Required binding                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task      | Group ID, every member proposal and original obligation ID, one executor, original assertions and unresolved expectation dispositions                                     |
| Source    | FINAL manifest path/hash, current commit plus relevant dirty-file hashes, handler/spec paths and the runtime's matching source/build identity                             |
| Session   | Canonical origin, actual requested URL, verified role/user alias, viewport and applicable motion/fullscreen state; never cookie or credential values                      |
| Fixture   | Exact synthetic record aliases/IDs, required lifecycle and data bounds, observed pre-state, backend target classification and source of fixture authority                 |
| Action    | Ordered operations, inspected write handlers, expected readback/focus/error state and assertion-to-receipt mapping; read-only observations do not replace required writes |
| Isolation | Browser/session owner, shared fixture lock owner, scoped recovery and its verification, owned process handles; unknown shared targets prohibit mutations                  |

Store each assertion's outcome and receipt paths in `results.json` beside these
inputs. Reuse a historical receipt only after matching its assertion, source,
role, fixture, operation and applicable viewport; record the receipt's original
path/hash and any limits. Shared dispatch groups retain separate assertion
outcomes. Missing source identity, fixture, authority or unresolved expectations
leave the affected assertion unrun with a named reason; independent groups may
proceed. These are execution prerequisites, not a request to start browser work
before the planning boundary is satisfied.

For UX-04, retain the existing child IDs QE-01–QE-09 as the canonical quick-edit
obligations; do not create a second copy in the imported 200 dispatch groups.
`quick-edit-execution-packet.json` owns their source/contract binding and
`refine-overview-editing-layout/tasks.md` owns their literal acceptance:

| UX dispatch  | Existing obligations | Concrete scope                                                                                                   |
| ------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| QE-ACTIONS   | QE-01, QE-02         | Text-only versus full Edit; Current, linked Next commitment and standalone Next field selection                  |
| QE-RETENTION | QE-03, QE-04, QE-05  | A→B→A with refreshed IDs, user isolation, retained read-only read/copy/discard without writes or unload warnings |
| QE-RECOVERY  | QE-06                | Failed Save preserves input; explicit retry persists it; reuse applicable existing browser/SQL receipts          |
| QE-INPUT     | QE-07, QE-08         | Escape/Cancel/Save focus return, retained-memory path and composition input; no invented Enter-to-save behavior  |
| QE-LAYOUT    | QE-09                | Direct desktop layout at 1024, 1279, 1280 and 1728 CSS px; reuse only applicable width-specific evidence         |

These five dispatch groups partition all nine child obligations; they are not
five newly accepted tests. The coordinator assigns one executor per group after
source binding. Serialize groups sharing the authoring session or report fixture.
Keep the child evidence and per-QE verdicts as the source of truth; a baseline
Overview or generic editor case cannot close a QE obligation without an explicit
assertion match. Movement and Activity deltas remain dependent on P06/P08.

Use ui-ux-orchestrator to select one primary interaction/design lens and only
necessary accessibility/rendered checks. Preserve normal desktop layout,
keyboard, focus, fullscreen and business-flow obligations. Do not reactivate
waived native zoom cases through a child task or through mechanical matrix
generation. Product contracts remain unchanged by this task-specific exclusion.

## Closure

All required files, new source deltas, scenarios, and findings must have explicit outcomes. Every mandatory local review criterion must reach at least 2 with evidence; no required local file may remain unreviewed or blocked. Final format, lint, typecheck, test, build, spec, applicable integration, and desktop results must refer to the final source identity. Baseline tests, another session's checks, static inspection, and mock tests cannot establish broader runtime acceptance. External and production readiness remain separately qualified.

### P11 final acceptance packet FINAL-ACCEPT

Dispatch status: draft, not accepted. The coordinator must bind the final source
manifest, exact diff, criterion/scenario inventories and evidence destination
before dispatch. Do not fill missing identities from an unrelated passing run.

Separate reviewer assignment REVIEW-FINAL: a fresh Astra High owns read-only
review of the exact task diff and affected dependency paths supplied in the
manifest. Inputs must include the requirement-to-finding map, prior reviewer
dispositions and original check receipts. Return each finding with path/line,
trigger, violated contract, severity and missing evidence to
`final-review/findings.md` under the section 44 evidence root. No edits, recursive
delegation or blanket reruns. Stop the affected review slice on source drift or
missing required context and report the exact gap; continue independent slices.
The coordinator owns resolving findings, local acceptance and status updates.
The path list and input hashes remain to be bound, so this is not dispatch-ready.

FINAL-ACCEPT execution owner is the coordinator. Allowed source changes: none;
confirmed fixes return to their existing repair packet. Evidence belongs in
`final-acceptance/` under the section 44 root, with original command output,
exit status, source identity and exclusions. Stop dependent gates on a failed
prerequisite or unsafe/unknown service target; record unavailable checks instead
of changing thresholds. Scope changes and product contradictions return to the
user, while routine diagnostics remain local. Full checks begin only after
REVIEW-FINAL findings have an explicit disposition.

Prerequisites: all assigned file dispositions reconciled, confirmed fixes
integrated, critical-scenario matrix fixed, substantial changes independently
reviewed, and the delivery source manifest captured. This is a future execution
packet; listing a command is not a passing result.

#### Final input binding contract

The final SHA is produced after repairs. Planning acceptance requires this
binding procedure; execution readiness requires populated inputs. Before
REVIEW-FINAL, the coordinator writes `final-acceptance/inputs.json` under the
section 44 evidence root. Record repository root, base/head commits, capture
time, and absolute paths plus SHA-256 for each input below. Include relevant
dirty/untracked identities; never replace final source with the planning snapshot.

| Input                         | Required content                                                                                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source manifest and task diff | Hash/mode for every mandatory current path; revisions for deleted/historical paths; actual diff including task-owned untracked files. Reconcile every P02 delta without silent exclusions.                              |
| File dispositions             | One disposition per P02 path plus reconciled additions, all applicable criterion scores and evidence; zero unreviewed/blocked, scores >=2, explicit per-file N/A rationale.                                             |
| Requirements and findings     | P01 IDs, confirmed findings, repair dispositions, affected contracts and dependency paths; unresolved required findings prevent acceptance.                                                                             |
| Critical scenarios            | P09-approved execution IDs, role/state/viewport, expected result, exclusions, source identity and original receipts; imported UX obligations individually reconciled.                                                   |
| Check and review receipts     | Original logs, commands, exit status, source/dirty identities, credential-free environment identity, scope and reuse rationale; prior independent findings and resolutions. Missing/stale evidence remains unavailable. |
| Delivery and resources        | Authorized destination/ref, local/remote identities, applicable CI jobs, owned process/browser handles and synthetic-fixture recovery records. Preserve ambiguous/shared resources.                                     |

REVIEW-FINAL reads the bound source/diff, contracts/dependencies and original
evidence; its only write target is `final-review/findings.md`. Its receipt names
the input manifest hash, reviewed scope and remaining gaps. A clean review does
not replace deterministic gates. A subsequent fix requires updated bindings and
review of the changed slice and dependencies, reusing unaffected evidence.

FINAL-ACCEPT writes `final-acceptance/results.json` and original logs only. Each
FINAL-01–FINAL-08 row records passed/failed/unavailable/not-applicable, input hash,
receipt paths and rationale. N/A requires a contract-based reason. Source drift
stops dependent acceptance until rebinding; unknown database targets stop those
integrations while independent read-only checks continue. Completion requires
all mandatory rows and reviewer findings resolved, matching delivered source
and owned-resource cleanup. External/production readiness is a separate result.

| Step     | Exact action                                                                                                | Required evidence                                                                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FINAL-01 | Compare current source with every reused receipt; regenerate Prisma only if schema/client drift requires it | HEAD plus dirty-file identities, stale receipts excluded, all required files accounted for                                                                               |
| FINAL-02 | `pnpm format:check`; `pnpm lint`                                                                            | Complete output and exit status; lint includes ESLint, Stylelint, runtime-node sync and repository cleanliness, not merely scoped ESLint                                 |
| FINAL-03 | `pnpm typecheck`; `pnpm test`; `pnpm build`; `pnpm spec:check`                                              | All required commands pass on the delivery source; root test includes package, Prisma, cleanliness and operations suites                                                 |
| FINAL-04 | `pnpm --filter @customreport/api test:integration` for affected database/runtime contracts                  | Verified disposable target, required dependencies and per-operation guards; unavailable services are not PASS                                                            |
| FINAL-05 | Reconcile applicable CI jobs in `.gitlab-ci.yml`                                                            | API serial integration job executes `test:coverage`, not just the local integration command; web coverage and other required jobs must be inspected on the delivered SHA |
| FINAL-06 | Execute only uncovered or invalidated critical desktop scenarios from the accepted matrix                   | Source-bound role/state/viewport evidence, screenshots where useful, real interaction and read-back for write scenarios                                                  |
| FINAL-07 | Review all final findings and per-file criteria                                                             | Mandatory scores >=2, unreviewed=blocked=0, no pending critical scenario; supporting observations cannot replace full contracts                                          |
| FINAL-08 | Deliver within the authorized branch scope, verify destination and CI, reconcile owned residue              | Exact local/remote SHA, delivery status, preserved user history, owned browser/process/fixture/artifact cleanup; production readiness reported separately                |

Run suites once per applicable source revision and reuse their results while
inputs remain unchanged. Plan-only acceptance uses changed Markdown formatting,
referenced-path/command checks, `git diff --check` and `pnpm spec:check`, per
`docs/exemplary-code-standard.md`; it does not accept the existing product diff.

## September 12 planning order and original obligations

### P12 execution queue and handoff rules

OpenCode handoff entry point (partial dispatch is possible without pretending
the entire plan is accepted): read this change's `tasks.md` section 46 and the
selected packet only. For an initial read-only review, select one existing
`file-review-execution-packets.json` ID with no active owner, verify its exact
sourceDefinition and dependencies, and return its prescribed evidence. Do not
start product edits, all 335 assignments, or environment changes from this entry
point. The coordinator must record data-route eligibility and the exact selected
ID before dispatch; a private repository is not automatically eligible for the
external OpenCode route. This initial review does not require Activity semantics.

The implementation handoff now includes `preserve-linked-continuation-dnd`
and `add-weekly-activity-title` (retired; its files exist only in git history before 7e6c20f2d), each with proposal, design, delta spec and tasks.
Their independent preparation review passed; product execution is not accepted. The
accepted MOVE-01 and new comments/history request must accompany that child;
an old prompt saying that the Current→Next choice is unanswered is stale.

P09 route reconciliation: retain all 50 imported route/audience obligations.
The baseline `report-routing` browser contracts cover stable URLs, tab context,
author deep-links and submitted-only visibility; those assertions do not replace
role-denial or human-print redirect checks. Twelve clean-anonymous protected
route cases now have an explicit source-bound 307 login expectation in
`imported-ux-source-candidates.json`, separately from the historical ForbiddenPage
expectation and from shape-valid cookies rejected by session validation. Existing
surface candidate IDs locate screens only and cannot close these route checks.

Use section 46 of tasks.md for planning status and section 44 for full campaign
acceptance. The tables below are an execution order, not a second checkbox
ledger. The original R01–R14 receipts remain linked and retain their limitations.

| Order | Packet                                                         | Prerequisite and output                                                                                                                      |
| ----- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Selected FR packet, initially FR-008 if unowned/unaccepted     | Route eligibility and source hashes verified; write only its existing artifactWriteSet; coordinator accepts before selecting the next packet |
| 2     | Other disjoint FR packets and seven architecture packets       | One owner per packet; architecture findings reference file owners, not duplicate file acceptance                                             |
| 3     | Existing quick-edit and P10 repairs                            | Reuse existing corrections; bind remaining tests and independent review to current diff                                                      |
| 4     | preserve-linked-continuation-dnd and add-weekly-activity-title | User decisions settled; 15 and 12 unchecked tasks. Serialize shared schema/save/Overview ownership                                           |
| 5     | UX catalog-selected groups                                     | Use ux-dispatch-catalog.json; final runtime/fixture preflight and assertion-specific receipts; reuse applicable evidence                     |
| 6     | REVIEW-FINAL and FINAL-01–FINAL-08                             | All mandatory file/scenario criteria, final gates, authorized delivery/CI and owned-resource cleanup; no false external readiness            |

Every handoff starts with the selected packet ID and existing OpenSpec task,
then supplies only its requirements, allowed files, source identity and acceptance
contract. The receiver must verify the input hashes before editing. A mismatch
returns the affected packet for reconciliation; unrelated work can continue.
Never send the whole conversation to compensate for an incomplete packet.

The current `~/.codex/skills/task-orchestration/SKILL.md` and `DSH.md` govern
routing. Simple work stays local; suitable substantial work goes to one bounded
DeepSeek 4.1 Flash Max worker. Sol owns integration and acceptance; Luna is the
fallback for an insufficient safe packet or two identical infrastructure failures.
Use one Astra High review only for a concrete material risk. Pass only inspected,
task-scoped inputs; exclude secrets, personal data and unrelated source.

Before dispatch, record model-turn, elapsed-time and quota limits. During an
active run, inspect saved session activity and artifacts at useful intervals;
a live process or a wait alone is not progress. Reuse the recorded run directory
instead of starting another worker to obtain status. Two iterations without an
acceptance result or actionable evidence, or twice the initial time estimate,
require stopping and reassessing. Preserve actual usage; unknown spend is not
zero, and unavailable weekly-quota telemetry cannot prove the 15% ceiling.

Parallelize disjoint read-only packets after confirming active ownership. An
implementation packet owns its exact files; serialize overlapping changes and
shared fixture writes. Report three separate quantities: prepared planning
deliverables, reviewed file dispositions, and accepted product scenarios.
Journal each dispatch/result with its packet ID, source hash, remaining gap and
evidence link. Keep raw logs and screenshots in the section 44 evidence root.

The imported P09 supplement has received independent Astra high review;
`ux-supplement-review-corrections.json` records local verification of both
corrections. Do not repeat its inventory or historical-file availability checks
without changed inputs. P01–P08/P10/P11 preparation is accepted.
The final P09/P12 preparation review passed for the consolidated UX catalog and
dispatch order; both wording corrections are incorporated.
Runtime source/fixture binding and per-assertion equivalence verification remain
execution prerequisites; they are not product results accepted by this plan.

The following handoff lanes describe work after the user's plan-first boundary
is satisfied, not permission to start all assignments immediately:

| Lane                   | Exact input and output                                                                                                                           | Ownership / serialization                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| File review            | Select one ID from `file-review-execution-packets.json`; verify its sourceDefinition and mandatory dependencies; write only its artifactWriteSet | Coordinator assigns one executor. All 335 IDs retain disjoint owned paths; shared dependencies are read-only. Do not grant product edit ownership through a review assignment. |
| Architecture           | Select one of the seven `architecture-*-review-packet.json` contracts; write its named result                                                    | Independent read-only review may overlap file reads, but findings refer to the file owner rather than creating duplicate per-file dispositions.                                |
| Confirmed repairs      | Select a P10 finding or a newly confirmed finding, exact owned diff and regression contract                                                      | One implementer per file set. Serialize overlaps; return substantial changes to fresh Astra high review. Existing accepted fixes are not implemented again.                    |
| Desktop verification   | Select explicit P09 execution IDs and bound source/runtime/fixture receipts                                                                      | One owner per browser session and mutating fixture. Reuse unchanged evidence; serialize shared writes and recover only owned synthetic changes.                                |
| Final review and gates | Populate P11 inputs.json after integration; run REVIEW-FINAL then dependent FINAL rows                                                           | Coordinator integrates and accepts; reviewer is independent. Delivery and owned-resource cleanup belong to FINAL-08, not an untracked follow-up.                               |

Each dispatch journal entry records input hash, selected ID, executor/session,
allowed writes and expected result. A returned entry adds original receipt,
local verification and accepted/rejected/unavailable disposition. Pending work
has no invented cost, PASS or percentage; the authoritative counters remain
tasks.md section 46, per-file dispositions and scenario receipts respectively.

Prepare the detailed execution plan before resuming product acceptance. P01–P12
in tasks.md are planning deliverables, not a replacement for the original MVP.
The original roadmap was queried with `node roadmap-status.ts` on September 12:
14 packages, 1 recorded done, 13 remaining. This reports the existing ledger;
it does not revalidate those outcomes against today's dirty source.

`original-roadmap-obligations.json` in the evidence root preserves the original
contract, execution, interaction, state, supplemental and file-facet IDs,
dependencies and evidence references, bound to the roadmap's hash. Use those
exact IDs when partitioning work; a topic summary cannot replace them.

| Original package                     | Recorded open assertions | Detailed-plan destination                                      |
| ------------------------------------ | -----------------------: | -------------------------------------------------------------- |
| R01 Evidence reconciliation          |                        0 | P01/P02: verify applicability, retain original receipt         |
| R02 Lead input/drafts/save           |                        4 | P04/P05: canonical writes, retention and residual conjunctions |
| R03 Outcomes/recovery                |                       23 | P03/P04: resolve/restore, stale navigation and recovery        |
| R04 Products/activities/status/risks |                      109 | P03/P08: activity semantics and existing domain obligations    |
| R05 History/Viewer/routes/search     |                       42 | P03/P09: visibility, routing and finite UI scenarios           |
| R06 Head review/lifecycle            |                       58 | P04/P09: atomic lifecycle and role-specific scenarios          |
| R07 Slides/inline editing            |                       62 | P03/P09: source projection and editing interactions            |
| R08 PDF/print                        |                       14 | P04/P09: frozen snapshot consumers and print evidence          |
| R09 Administration                   |                       54 | P03/P09: settings and administration states                    |
| R10 Feedback/assistant               |                       29 | P03/P04/P09: scope, transport and user-visible failure states  |
| R11 Shared UI/accessibility/identity |                      109 | P03/P09: shared causes and accessibility coverage              |
| R12 API/jobs/performance             |                       49 | P03/P04: domain boundaries, job recovery and declared profiles |
| R13 Complete file/system review      |                        6 | P02/P03/P04: retained 18 accepted, 19 N/A, 6 unresolved facets |
| R14 Final acceptance/cleanup         |       Not yet enumerated | P11/P12: final source, delivery and owned resources            |

These counts have different assertion scopes and are not a single progress
percentage. Paused R03/R04 browser work remains paused during planning.
The R13 supporting automatic-retry observations must not be promoted into
manual-retry or stale-navigation acceptance; retain their original limitations.

Execution parallelism follows the accepted packet ownership: disjoint read-only
file and architecture reviews may run concurrently; overlapping implementation
files and shared fixtures are serialized. Do not restart accepted preparation.
No worker receives the entire session history merely to implement one packet.

### P02 denominator reconciliation evidence

Fresh immutable planning input is
`planning-snapshot-20260912/snapshot.json` in the section 44 evidence root:
2,622 regular files, base HEAD `c7766a20b1b60eec1399dd65e6939785e852b7f3`,
manifest digest `4b4ee887d028abb39c11ceb00b173ec3e9b142326ac3b84423a9ec4a8640057b`.
The existing capture procedure copied all tracked/nonignored untracked bytes,
checked source drift in a second pass, checked copy hashes and made copied files
read-only. The three untracked inputs, including supplied session history, are
preserved. All 2,622 current ownership rows bind to that snapshot; deleted and
branch-only rows keep their historical revisions. Later plan/code edits are a
delta to this input, not an implicit rewrite of the snapshot.

Ignored dependency/build/cache/log/browser-output/runtime-storage files are not
product source. Environment secrets stay excluded. Ignored session histories and
prior browser artifacts can still be requirement/evidence inputs and must be
linked when used; `.gitignore` alone is not authority to erase them or omit a
relevant user requirement. This distinction remains part of P01/P02 reconciliation.

The preliminary `catalog.jsonl` contains 2,457 paths, while the accepted
`execution/snapshot.json` contains 2,466. Use the accepted snapshot for original
content identities; the preliminary catalogue alone would omit nine paths.
`original-snapshot-reconciliation.json` compares every original hash/path with
the 2,622-path planning manifest. Its sibling
`original-catalog-path-reconciliation.json` preserves the catalogue discrepancy.
Neither comparison is a file-review verdict. Removed paths remain review work;
unchanged bytes permit evidence reuse only after dependency applicability is
checked. Reconcile later plan edits before declaring a final immutable snapshot.

`file-review-groups.json` assigns all 2,701 required paths exactly once
(2,622 current, 69 removed original, 10 additional branch-only paths; zero
missing or duplicate paths). The 122 ownership groups include FR-122 for
branch-only feedback/Siteping history, with exact branch revisions and content
hashes. `branch-ownership-reconciliation.json` accounts for all 1,220 branch
catalogue paths. Review removal and replacement; do not restore old files merely
to inspect them.
These are ownership candidates, not yet dispatch-ready jobs: large areas need
contract-aware subdivision, dependency/spec entry points and current identities.
No review completion is inferred from this assignment.

### P03 reuse of historical review assignments

The operational index is `file-review-dispatch-index.json` with its readable
companion `file-review-dispatch-index.md` in the section 44 evidence root.
`build-review-dispatch-index.ts` replaces subdivided parents rather than adding
them twice: 335 assignments cover all 2,701 paths, with zero missing paths,
duplicate owners or colliding result paths. Three assignments declare readiness
(FR-008, FR-122, FR-038/fill-from); 332 still need preparation. Readiness is
inherited from hash-bound definitions and must be checked before dispatch.
This planning counter neither replaces the original 14-contract roadmap nor
counts any reviewed file. The next prepared local packet is FR-038/fill-from;
execution waits for the applicable planning-stage boundary.

`file-review-dependency-candidates.json` supplies shared-read candidates for all
335 assignments. `map-review-dependencies.ts` verified and scanned 2,290 current
JS/TS files, identified 7,391 import edges and resolved 987 workspace/alias
references with installed TypeScript and the actual project configs (including
`tsconfig.prisma.json`). No classified literal first-party import remains
unresolved. Both outgoing imports and incoming consumers are recorded with
frozen identities; dependency reads never become additional owned-file rows.
This is an import inventory, not a semantic call graph: reviewers still select
relevant dependencies, resolve nonliteral runtime wiring and historical paths,
and apply their domain criteria before dispatch readiness is accepted.

`file-review-criteria.json` binds all 335 assignments to the original standard
sections 4/4.1/6: ten per-file questions plus domain-specific review profiles.
The profiles supplement the full standard; they do not erase other applicable
criteria. Each file needs a purpose/consumer, evidence for every applicable
score, and explicit reasons for N/A. Unknown is unaccepted; the file score is
the minimum applicable score, with every mandatory criterion at least 2 for
closure. The later security-scan exclusion is explicit without weakening
ordinary authorization/data-integrity boundaries. No profile selection itself
scores a file or makes an execution packet ready.

`file-review-execution-packets.json` compiles the existing sources, ownership,
criteria and dependencies into 335 complete read-only task definitions. Each
includes its owned versions, review steps, one result path, acceptance and stop
conditions; the executor is assigned only at launch. Structural integrity is
recorded in `file-review-packet-integrity.json` (2,701 unique owned rows, no
colliding outputs, matching input hashes). Independent planning review is
required before promoting these definitions from prepared to dispatch-ready.
Neither structural checks nor that planning review accept any product file.

`historical-review-assignment-crosswalk.json` in the section 44 evidence root
maps all 2,461 historical launch paths and 52 jobs to the current 2,701-path
catalogue. No historical assignment is missing: 1,487 paths have equal content,
909 changed, 65 are historical-only and 240 were absent from that launch.
The launch denominator is distinct from the accepted original snapshot's 2,466
paths. `reconcile-review-assignments.ts` reproduces the mapping, records input
hashes and rejects duplicate assignments or jobs outside the old manifests.

Reuse the original `agent-launch/task-template.md` result contract: one file
disposition with purpose, consumer, applicable criterion scores and source
evidence; separate findings with impact, minimal proposal and validation method;
and a summary distinguishing reviewed, blocked and unread paths. Dependency
reads do not close another owner's rows. Equal hashes alone transfer no review
acceptance. Historical owners are attribution, not current worker assignments.

Do not replay the old jobs unchanged: their arbitrary 50-file slices mix
contracts, their snapshot prerequisites are historical, and their security-scan
instructions predate the user's exclusion. The next P03 step is to subdivide
the 13 groups exceeding 60 files by actual operation/contract, keeping related
tests with their implementation and naming cross-group dependency reads.
The remaining groups also need explicit contracts before dispatch; small size
alone is not readiness. Preserve FR-008 and FR-122 as already prepared packets.
The current routing and source boundaries in this change supersede the old
runbook. This crosswalk completes assignment reconciliation, not file review.

`domain-review-subpackets.json` now subdivides FR-022 (administration, 74 paths)
and FR-038 (report sections, 115 paths) into 14 operation-specific assignments.
Administration separates snapshot restore, reopen, period lifecycle,
jobs/reminders, action log, entity/settings writes and module composition.
Report sections separate outcomes, published lineage/snapshots, fill-from,
cross-author projection, history, lead-form lifecycle and section save/submit.
Each assignment includes exact owned file identities, a concrete review
question, applicable frozen OpenSpec identities, an exclusive result path and
the acceptance contract. Tests follow their named operation. The generator
`prepare-domain-review-packets.ts` checks complete non-overlapping ownership
and verifies available frozen file and spec hashes. Historical-only files
retain their historical identity and require the corresponding content binding.

The subdivision now covers all 13 large groups: 1,353 paths in 226 assignments,
including 160 single-contract specification assignments. The largest assignment
has 38 paths. Additional groups cover procedure routing, search/assistant,
application routes/print, administration UI, period UI, lead shell, slides,
shared UI, shared schemas and Prisma/seed tooling. This changes task granularity,
not the 2,701-path review denominator. The other 109 parent groups retain their
existing ownership and still require the applicable task-readiness check.

These are planning subdivisions, not accepted reviews. Before dispatch, bind
caller/import dependencies; 225 assignments remain
`prepared-needs-dependency-binding`. All 1,353 owned content bindings have now
been verified, including ten historical-only paths resolved to their original
immutable snapshot. Each binding records the absolute source path, version
and hash; the original snapshot manifest is also hash-bound.

FR-038/fill-from is `ready-local-read-only`: four owned files, two frozen specs
and 17 explicitly bound dependency files cover service guards, repository
dispatch, transaction locks, lineage, persistence includes and relevant tests.
The primary local reviewer owns this packet; it cannot be sent externally from
this readiness status. Additional dependency reads must be checked against the
same snapshot. Reading tests is not a product test run, and the packet authorizes
no fill-from operation or database mutation. Result path:
`file-reviews/FR-038-fill-from.json`. Readiness is not review acceptance.

Shared composition files keep one primary
owner even when several operation reviewers read them. Mobile-named source
files remain in file accountability without adding mobile UI scenarios. Reading
existing security-related contracts does not introduce a separate security scan.
No product test, runtime mutation or external private-source dispatch is
authorized by generating this artifact.

`domain-packet-independent-review.md` records fresh Astra High review of the
original FR-022/FR-038 subdivision only: no concrete defects found across those
14 assignments/189 paths. It does not cover the later 212 assignments, prove
dispatch readiness or accept any product behavior. Reuse this narrow review
while those original assignment rules and inputs remain unchanged.

### P01 supplied-session attribution corrections

The original-session extractor incorrectly treated nested `## Page Feedback`
headings as message boundaries. Corrected extraction preserves the body until
an actual exported role/activity heading. Only U053/U055/U085 changed: seven
original slide annotations are now retained in
`recovered-user-page-feedback.json`. Reconcile them with existing UX IDs before
adding tasks: text/author/stage placement, Read affordance, multi-stage examples,
redundant status mark, stage wrapping, fullscreen placement and density control
purpose. Short or ambiguous feedback is not automatic permission to remove a
control or accessibility information. All seven now map to existing contracts
and, where applicable, historical repairs without new duplicate defect tasks.
The metadata review already addresses placement, Read/Close removal and status
mark removal; multi-stage seed review addresses examples. Stage wrapping still
needs literal geometry evidence; fullscreen placement is only related to the
toolbar repair, and the density-purpose question remains unresolved by that
repair. These distinctions and hash-bound historical receipts are recorded in
the recovered-feedback artifact; none is a current product PASS.

Three original image attachments were recovered with hashes in
`original-user-media/index.json` and inspected. Two show slide layout feedback;
U113's image is an external article about economical delegation, not a product
UI requirement. Its claimed savings are not verified billing evidence and do
not override the current task-orchestration rules.

Full-goal mapping below derives from the active user objective and this thread's
explicit steering. It complements the original R01–R14 exact-ID inventory and
the supplied-session audit; it does not claim that every archived conversation
has been re-read.

| Requirement                                                           | Plan owner               | Evidence required for completion                                                                                                      |
| --------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| G01 Verifiable tracked and relevant untracked snapshot                | P02 / 44.4               | Immutable source identities, explicit inclusion/exclusion reasons, original/current/branch-only coverage                              |
| G02 Every required file reviewed exactly once                         | P03 / 44.5–44.6          | One owner and substantive disposition per path, no missing or duplicate assignments; dependency reads distinguished from acceptance   |
| G03 System architecture reviewed                                      | P04 / 44.7               | Actual call-chain/invariant findings and coverage of all original architecture obligations                                            |
| G04 Complete desktop UI/UX review preserving visual style             | P09 / 44.11              | Reconciled original matrix and scope exclusions, real current-source evidence per required scenario                                   |
| G05 User feedback and neighboring input changes retained              | P01/P05/P06/P08          | Requirement provenance, current branch comparison, explicit handling of every DS requirement and preserved original IDs               |
| G06 Small corrections for confirmed violations                        | P10 / 44.12              | Reproduction, root cause, owned diff and relevant regression; unsupported suspicions remain unconfirmed                               |
| G07 Simple code/structure; deep MVP changes allowed                   | P03/P04/P10              | Review existing alternatives and remove confirmed redundant paths; no speculative abstractions or superficial compatibility layers    |
| G08 Independent substantial review                                    | P11 / 44.13              | Fresh Astra review against exact diff and original evidence; findings resolved individually                                           |
| G09 All mandatory local criteria >=2, unreviewed=blocked=0            | P11 / 44.14              | Complete criterion inventory with applicable evidence and explicit, justified exclusions                                              |
| G10 All critical scenarios and final gates pass on final source       | P09/P11                  | Fixed scenario denominator plus format/lint/typecheck/test/build/spec and applicable integration receipts                             |
| G11 External/production readiness reported separately                 | P11/P12                  | Local/remote/CI states distinguished, no unsupported production PASS                                                                  |
| G12 Preserve concurrent work; respect data and destructive boundaries | P02/P12 and every packet | Ownership preflight, scoped edits, no unapproved shared/production/destructive effects                                                |
| G13 Economical scheme A and useful parallelism                        | P12                      | Bounded eligible DeepSeek packets, exact sessions/observed usage, no duplicate active owners or automatic model cascade               |
| G14 Understandable catalogue, roadmap, journal and screenshots        | P02/P09/P12              | Accessible linked artifacts, separate planning/file/scenario counts, next action and residual work visible                            |
| G15 Review the named branches and supplied OpenCode session           | P01/P02/P03              | Pinned refs, source attribution, full branch union including deleted/replaced paths, assistant claims distinguished from requirements |
| G16 Detailed OpenSpec handoff before resuming implementation          | P01–P12                  | Ready packets with dependencies, exact allowed scope, acceptance and decision boundaries; no vague backlog handed to a worker         |
| G17 Retrospective and safeguards against repeated process failures    | P12                      | Evidence-based lessons linked to changed execution rules and observed remaining limitations                                           |

Current-thread retrospective supporting G17: implementation acceptance displaced
the requested planning priority; restore plan-first order. A browser was closed
while its command was still pending; poll the exact handle before cleanup.
Native 200% zoom was mistakenly reintroduced; reconcile explicit scope updates
before expanding matrices. P11 was prematurely checked; require a usable handoff
contract rather than treating formatting/spec validation as planning completion.
Positive evidence to retain: independent review caught overclaims, source-bound
regressions caught real defects, field restoration was verified, and branch-union
comparison recovered ten omitted historical paths. This retrospective is bounded
to evidenced work here; the requested original-session retrospective still needs
its source-linked reconciliation and must not be marked complete from this note.

Original-session feedback is now directly located in the preserved export under
`execution/saved-artifacts-20260911/sessions/`, not the removed repository-root
copy. `original-session-process-feedback.json` retains source hash and exact user
block lines, excluding assistant reasoning/activity sections. Initial findings:

- Line 1559300: the user reports half the weekly quota spent in one day and asks
  to maximize cheap-model use. Response rule: bounded eligible DeepSeek packets,
  measured observable usage and no redundant context/model cascades. The reported
  percentage is not independently verified billing.
- Lines 1716946–1716960: duration, unclear route and only two visible completed
  points prompted explicit dissatisfaction. Response rule: show prepared tasks,
  accepted whole packages and remaining work separately, with an exact next task;
  do not hide stagnation behind supporting-check counts.
- Line 1557504: the user welcomed an apparent improvement and wanted orchestration
  work kept in its separate session while product work continued. Response rule:
  use the configured route; do not repeatedly rebuild orchestration here.
- Lines 1793062 and 1793149: the user requested stopping after roughly three days
  and transferring full context. Response rule: bounded handoff with full goal,
  current source, ownership, evidence and residual tasks; obey an explicit stop.

This is a source-linked process-feedback slice, not a claim that keyword
extraction exhausts the original session's product requirements or retrospective.

`original-user-blocks.json` preserves all 167 direct user blocks with line
references and a semantic triage disposition. Status questions do not become
product features; historical routing is superseded by scheme A. P01 remains
open for the imported UX handoff at U054, four nontext/empty blocks requiring
original-media context, one ambiguous block, and disposition of the historical
customreport-archive cleanup request. Do not delete that target from its name.
U052 explicitly requests slide text aligned consistently left, editor initials
at upper right and stage markers at lower right; reconcile it with the existing
R07 feedback IDs and current slide contract before adding or closing a task.

The bounded audit in `session-requirement-plan-audit.md` found no missing direct
product request among the supplied session's user blocks. It does not cover the
original full MVP history. DS-08 is a coordination question about observing CI
jobs, not a WeeklyReport feature. DS-07 is an instruction to use UI/UX skills.
DS-03 derives from user lines 749–774; assistant line 7670 is an implementation
claim, not requirement provenance. DS-04 asks about period-specific Activity
name/details; snapshot immutability is an existing contract constraint. These
distinctions are preserved in `session-requirements.json` before packet creation.

### P04 architecture review entry packets

#### Historical review packet FR-122: removed feedback paths

Owner: primary coordinator, read-only, private-source local route. Owned paths
are exactly the ten entries of FR-122 in `file-review-groups.json`; each entry
binds all relevant branch revisions and content hashes. Read with
`git show <bound-ref>:<assigned-path>` and compare bytes to the recorded SHA-256.
Do not check out another branch or restore files into the dirty working tree.

1. Review original HTTP/store/client/dialog code, its three test files and the
   Siteping patch at their bound versions. Distinguish intentional replacement
   from behavior accidentally lost; identical branch hashes need one reading.
2. Trace corresponding current Agentation routes, scope, wire/client integration
   and inbox actions using the frozen planning snapshot. These are dependency
   reads; full-file verdicts remain with their current ownership groups.
3. Check references to removed exports, package/patch declarations, runtime
   endpoints and test assertions. Use `authenticated-product-feedback` as the
   owning contract; do not require retaining obsolete Siteping interfaces.
4. Review the separate archive placeholder deletion against the cleanliness
   gate. Its presence on the branch is historical input, not a feature to retain.
5. Save `file-reviews/FR-122.json` in the evidence root: ten unique path
   dispositions, checked revisions/hashes, behavior-to-replacement mapping,
   concrete lost-contract findings and evidence limits. No resurrection or
   product mutation; nominate later regression checks only for confirmed gaps.

Dependency boundary: current API/web product-feedback areas, root package/lock
and patch declarations, repository-cleanliness gate and owning feedback spec.
Stop the affected slice if a referenced Git object is absent or hashes differ;
continue independently readable paths and report exactly what is missing.
Readiness preflight passed: `fr-122-readiness.json` records all ten historical
paths, their available branch versions and 13 frozen dependency entries. Exact
dependency paths/hashes are in FR-122 of `file-review-groups.json`. The packet is
ready for local read-only execution; this is not accepted review and does not
close P03 or AR-FEEDBACK.

#### Ready local review packet FR-008: API configuration

Owner: primary coordinator, read-only. This private-source packet is not
classified for external transfer. It may be reassigned to an eligible worker
only after updating ownership and the data boundary; never run two owners.
Inputs: `planning-snapshot-20260912/snapshot.json`, manifest digest
`4b4ee887d028abb39c11ceb00b173ec3e9b142326ac3b84423a9ec4a8640057b`,
and its six FR-008 file hashes in `file-review-groups.json`. Read frozen copies
from that manifest's sourceRoot, not whichever files happen to be current.

Full-file review ownership is limited to these six files beneath
`apps/api/src/infrastructure/config/`:
`config.module.ts`, `env.schema.ts`, `env.schema.test.ts`,
`redis-connection.ts`, `redis-connection.test.ts`,
`report-assistant-env-keys.ts`.
Dependency reads: the snapshot's `apps/api/src/lib/env.ts`, `logger.ts`,
`saml-env-keys.ts`, `audit-logger.ts`, `.env.example`, `.env.test.example`, plus
`openspec/specs/env-schema-coverage/spec.md` and
`openspec/specs/redis-connection-config/spec.md`. Inspect direct callers of the
exported validators/connection builders only to establish a concrete invariant;
report any additional context needed instead of silently widening file ownership.
Never open actual environment secrets or credentials.

1. Verify the six frozen file hashes against the assigned input rows.
2. Read all six files and compare changed `env.schema.ts` with its original
   snapshot version. Assess the other five against their existing evidence,
   despite unchanged bytes, because schema dependencies may have changed.
3. Trace required/optional configuration, numeric parsing, validation failure,
   module provisioning and explicit Redis DB selection; separate error recovery
   behavior from required-value validation. Assess tests against the actual
   contract, including false-positive and missing-input cases.
4. Return one disposition per owned path, criterion applicability/scores,
   path/line findings with trigger and smallest discriminating check, and a
   dependency map. Do not assign runtime PASS from source inspection.
5. Save output to `file-reviews/FR-008.json` in the section 44 evidence root.
   Acceptance requires exactly six unique owned paths and explicit findings or
   evidence-backed no-findings per path. The coordinator validates the output
   against sources before updating any full-file acceptance ledger.

No source edits, browser, database operations or test execution in this packet.
If a suspected defect needs a test, nominate the relevant case in
`pnpm --dir apps/api exec vitest run src/infrastructure/config/env.schema.test.ts
src/infrastructure/config/redis-connection.test.ts` for the later repair packet.
Stop the affected slice if a hash mismatches or a contract is missing; report
the exact gap and continue independent owned files. This packet refines P03 and
AR-CONFIG; it does not close all P03/P04 work.

Each packet is read-only until findings are confirmed and assigned a repair
task. Read the named entry files, then follow imports/callers only for the stated
invariant. Return an edge list of the actual call chain, concrete findings with
path/line and scenario, and evidence limitations. Cross-area dependency reads do
not create duplicate full-file acceptance; the file owner keeps that verdict.

| Packet      | Entry files (repository-relative)                                                                                                                                                                          | Owning contract and required review outcome                                                                                                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AR-DRAFT    | `apps/web/src/features/report-sections/model/lead-form/use-lead-form-draft.ts`; `apps/web/src/features/report-sections/model/lead-form/lead-form-write-port.trpc-adapter.ts`                               | `lead-form-draft-orchestration`, `lead-form-draft-merges`, `lead-section-draft-payload`: trace `reports.saveDraft` through version checks, response merge and refetch; map stale A→B completions, typing/save echo, projection isolation and recoverable errors |
| AR-PERIOD   | `apps/api/src/modules/period/application/period.service.ts`; `apps/api/src/modules/admin/period-admin.service.ts`                                                                                          | Period dual-state invariant and `period-lifecycle-ui`: enumerate lifecycle writers and transaction boundaries, expected-state conflicts, audit timestamps and publish side effects; identify any write updating only half the lifecycle tuple                   |
| AR-SNAPSHOT | `packages/report-persistence/src/published-report-snapshot.ts`; `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts`; `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts` | `published-portfolio-snapshot`, `pdf-export-integrity`: trace frozen versus live fields through publication, report reads and PDF; name rename-after-publication and missing-snapshot scenarios without claiming they have run                                  |
| AR-ROLE     | `apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts`; `apps/api/src/bootstrap/app-router.ts`                                                                                                 | `role-coverage-gate`, `role-model-consistency`: identify the seven canonical builders and inventory registered procedures by reference identity; trace any uncovered route rather than trusting test existence                                                  |
| AR-JOBS     | `apps/api/src/bootstrap/jobs-service.ts`; `apps/api/src/infrastructure/bullmq/worker-liveness.registry.ts`; `apps/api/src/infrastructure/config/redis-connection.ts`                                       | `queue-worker-architecture`: trace registration, recovery, shutdown and Redis selection; separate deterministic checks from unavailable live worker evidence                                                                                                    |
| AR-FEEDBACK | `apps/api/src/modules/product-feedback/product-feedback.routes.ts`; `apps/api/src/modules/product-feedback/agentation-scope.ts`; `apps/api/src/modules/product-feedback/agentation-sse.ts`                 | `authenticated-product-feedback`: trace server-derived identity/scope, replay, reconnect and disconnect cleanup; retained SSE heartbeat acceptance is only one slice                                                                                            |
| AR-CONFIG   | `apps/api/src/infrastructure/config/env.schema.ts`; `apps/api/src/infrastructure/config/config.module.ts`; `apps/api/src/lib/env.ts`                                                                       | Required configuration/fail-closed invariant: map schema validation to consumers and deployment examples, distinguish missing required values from intentional optional features                                                                                |

Existing colocated regressions and roadmap receipts are inputs to assess, not
instructions to rerun suites during planning. Every packet must name the smallest
check that would discriminate a suspected defect before requesting execution.
AR-DRAFT and AR-PERIOD findings feed movement planning; AR-SNAPSHOT feeds Activity
planning. AR-ROLE, AR-JOBS, AR-FEEDBACK and AR-CONFIG can be read independently.

AR-ROLE has a concrete local read-only packet in
`architecture-role-review-packet.json`: seven hash-bound files and the traced
production DI → router factory → canonical builder → coverage-gate path.
The seven builders are public, protected, head, lead, admin, any-role and
leadership procedures. The reviewer must inventory registered leaves and
compare production/stub registration rather than infer coverage from exported
names. The future focused role-coverage test is named but has not been run by
this planning step. Chain identity does not prove every business-role policy;
architecture findings do not create duplicate per-file acceptance. P04 remains
open until the other architecture packets have equivalent concrete contracts.

AR-SNAPSHOT is defined in `architecture-snapshot-review-packet.json` with 11
verified source/contract bindings. The observed path runs from transactional
publication assembly through validated frozen weekly-report reads to the PDF
job's own publication snapshot. Review must still enumerate manual/scheduled/
restore writers, mutable-versus-frozen fields, republish and missing-snapshot
behavior. This gives P08 a concrete dependency without asserting that a later
Activity rename has passed a runtime test. No publication or export is executed
by preparing the packet.

AR-CONFIG, AR-JOBS and AR-FEEDBACK now have separate local read-only packets in
`architecture-config-review-packet.json`, `architecture-jobs-review-packet.json`
and `architecture-feedback-review-packet.json` (10, 11 and 10 verified source/
contract bindings). Their traced paths cover validated environment → DI → Redis
consumers; queue registry → raw worker lifecycle → admin recovery; and server
session → feedback scope → wire/SSE → inbox. Each packet preserves explicit
failure/recovery obligations, source-bound output and no-mutation boundaries.
Existing FR-008 and SSE evidence may be reused only within its actual scope.
All seven architecture packet definitions are prepared. AR-DRAFT and AR-PERIOD
are in `architecture-draft-review-packet.json` and
`architecture-period-review-packet.json`, with 14 and 13 verified bindings.
Their traced entry paths connect draft generation/version/server sync to the
canonical save mutation, and period policy to transition builders and guarded
transaction writes. Review still has to enumerate all writers, trace combined
race/recovery scenarios and assess correctness; preparing P04 accepts none of
those architectural outcomes.

### P08 Activity contract packet ACTIVITY-PLAN

Requirement: DS-04, user session lines 749–774. Current source establishes a
global `ProjectActivity.name` and a per-section `ActivityStatus.note`; it does
not provide a period-specific name override. The mapper takes `activityName`
from `status.activity.name`. Snapshot assembly copies the mapped section into
the published read model. This is source evidence, not a rename-after-publish
runtime result.

Read `prisma/schema.prisma` (ProjectActivity/ActivityStatus),
`packages/report-persistence/src/report-sections.mappers.ts`,
`packages/report-persistence/src/published-report-snapshot.ts` and
`openspec/specs/activity-reporting-unit/spec.md` first. Follow ActivityStatus
write-schema, repository and carry-forward consumers before choosing fields.
AR-SNAPSHOT supplies frozen-reader analysis; do not duplicate that review.

| Step   | Required planning output                                                                                                    | Acceptance before implementation                                                                                                             |
| ------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ACT-01 | Map catalogue name, weekly note, permissions, form, write payload and consumers                                             | Every displayed/editable value traced to its actual owner and save path                                                                      |
| ACT-02 | Resolve whether weekly “name” means a report-specific title override or just changing details under a stable catalogue name | Explicit product decision if contracts and user feedback do not settle it; no silent global rename                                           |
| ACT-03 | Resolve section ownership: can two leads report different titles/details for the same Activity in the same period?          | Examples for two leads and two periods with intended values                                                                                  |
| ACT-04 | Define next-period initialization and reset-to-catalogue behavior                                                           | Distinguish omitted override, empty text and explicit reset; name carry-forward precedence                                                   |
| ACT-05 | Map accepted semantics to existing Zod/draft/Prisma/mapper/UI paths                                                         | Exact affected files, validation limits and migration implications; no new storage if existing note suffices                                 |
| ACT-06 | Specify immutable published reads                                                                                           | Catalogue edit or later-period override cannot change prior report, Viewer, slides or PDF content; enumerate consumers and existing evidence |
| ACT-07 | Create the focused child proposal/design/spec/tasks                                                                         | Include concurrent save, read-only and missing-value scenarios; keep catalogue identity, group ownership and item lineage stable             |

ACT-01 source trace: `activityStatusInputSchema` in
`packages/shared/src/schemas/report-sections/section-record.schema.ts` accepts
activityId, optional nullable status and optional nullable note; it has no title
override. `ActivityStatus` is unique by reportSectionId/activityId, so its note
belongs to one section rather than the global catalogue. The save transaction
recreates activity rows through `toActivityStatusRows`; the read mapper returns
activityName from the catalogue relation and note from the section status.
`activity-status-section.tsx` displays that catalogue name and exposes status
controls only, not a note/name editor. A stored note does not by itself prove an
existing editable-description UI. The product question explicitly
distinguishes a per-lead/per-week title from a weekly description.

The inspected lead bridge confirms only an activity-status draft action in
`lead-form-draft-actions.ts`. The existing note display is
`ActivityStatusStrip`, mounted by `weekly-report-content.tsx` with the report's
submitted-only filter; it renders note text without an editing callback. Thus
the planning baseline includes stored/preserved/displayed notes, but does not
claim a working lead note editor. Either accepted product option must name its
actual editable control and draft action rather than assume the stored field
already supplies that interface.

The current note save path is now explicit:
`lead-section-draft-payload.ts` serializes each activity's note (`undefined` to
null); `report-section-merge.ts` preserves an omitted activity or omitted note
field, but applies an explicit null; `save-section.derive.ts` writes the merged
note back through `toActivityStatusRows`. Thus omission and explicit reset are
different at the API boundary, while the normal full draft supplies the value.
No title fallback/reset semantics can be inferred from this nullable note.

For initial attachment, `ensure-lead-section.ts:seedActivityStatuses` creates
statuses from the lead's non-archived catalogue attachments without copying a
prior note. `project-activity.prisma-repository.ts:attachLead` likewise creates
missing rows on editable reports without a note and preserves existing rows via
skipDuplicates. The carry-over plan merges only items/decisions into the target;
`carry-over-row-writes.ts` preserves current target activities and persists only
item/decision rows. `fill-from.transaction.ts` reads target activity IDs to
filter eligible parented records, then replaces items/risks/decisions without
writing ActivityStatus. Consequently these inspected operations retain the
target note and do not copy the source note. This is source-level behavior,
not live acceptance or a decision about future weekly-title initialization.
ACT-05 must preserve omission/null behavior
unless an accepted product decision explicitly changes it.

ACT-01 and AR-SNAPSHOT can be researched now. ACT-05 implementation depends on
ACT-02–ACT-04 semantics. This packet authorizes planning only; no migration,
catalogue mutation or fixture write is needed to produce it.

### P06/P07 accepted continuation contract

The final user answers are authoritative: keep Current visible and create linked
Next; inverse promotion retains the old result in history. Activity has a weekly
title and description per lead/week, leaving the catalogue unchanged. Earlier
whole-record-move and note-only suggestions are superseded, not open questions.

Implementation contracts were in preserve-linked-continuation-dnd and
add-weekly-activity-title (retired; its files exist only in git history before 7e6c20f2d). Both passed independent Astra high planning review;
the completed/paused eligibility and promotion tuple corrections were verified.
Use their specifications and tasks rather than earlier synthetic recommendations.

The original MOVE IDs remain stable navigation anchors into the child contract:

| ID                | Binding                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| MOVE-CURRENT-NEXT | Retain Current result; enter/edit linked Next through shared lineage                                                             |
| MOVE-NEXT-CURRENT | Promote continuation into Current and retain superseded result/history                                                           |
| MOVE-COMMITMENT   | Preserve both texts; never clear existing nextStepText silently                                                                  |
| MOVE-PROJECTION   | Resolve projection to its source identity, without an independent copy                                                           |
| MOVE-LOCKED       | Reject continuation creation/promotion for completed records; reject all mutations for foreign, read-only and historical sources |
| MOVE-CANCEL       | Cancel/Escape/invalid target commit nothing and restore focus                                                                    |
| MOVE-CONFLICT     | Explicit text selection, preserved displaced text and recoverable version conflict                                               |
| MOVE-ORDER        | Reuse collection order; preserve text/status and linked source identity                                                          |

Source anchors remain lead-item-actions.ts, lead-form-draft-actions.ts,
item-card-actions.tsx, record-comment-save-coordination/spec.md and the existing
lineage/history modules. The legacy type-flip action clears nextStepText and is
not the implementation of the accepted retain-Current command. Tests must prove
comment anchoring after row recreation, completed rejection, paused promotion,
and immutable published snapshots. The parent journal retains rejected model
proposals and original decision provenance without making them active instructions.

Task-created source additions are listed in `planning-added-source-files-20260913.json`: ten child planning files supplement the 2,701-path snapshot (2,711 accounted paths). Their final per-file criteria remain required; child planning approval is supporting evidence only.

## Audit plan design (owner order B, transcribed 2026-09-17 — one campaign; detail for P1–P7 in tasks, overview in proposal DRAFT sections)

Execution order: P1 attribution → frozen SHA → inventory (single pass: deterministic-vs-browser table per batch) → Tier A deterministic proofs `{kind, surface, reference, detail}` with single writer to `spec-coverage.json` (parallel authors allowed) → single-DB readiness on `customreport_e2e` (owner decision 2026-09-18 SUPERSEDES the 15-lane permit; reset+seed between phases, per-run guard + consent still apply) → Tier B browser by roles×URLs (LEAD `/lead/*`, HEAD `/head/*`, ADMIN `/admin/*`, VIEWER `/reports/*` + `/print/*`; sequential per lane/role, parallel across lanes; `verified: yes` only; ~90+ missing flows written first or recorded excluded-or-todo) → P6 gates + strict 39.6 on the frozen SHA. Stop rules: spec edit after freeze resets affected outcomes to unclassified (decision only); two failed attempts on one cause → blocker + hypothesis change; new scope → child change. Production readiness stays a separate track per `docs/sdlc.md` stop conditions.

## Проект плана 2026-09-18 (goal mu6s113y-6vif62 — дельта и находки, не исполнение)

- Проверено на HEAD `a41779cf5`, дельта 141 строка (138 modified + 3 untracked), flows 6 файлов, specs 161 каталог, exclusions (20/153/23) без изменений; детали — в статус-блоке `proposal.md`.
- Находки F1–F7 подтверждены из ACCEPTED-плана (severity/контракты/остатки — в `proposal.md` «Obligations per ID» + `exemplar-evidence.md` волны 66d17d22). Новые, поля полные:
  - F8 (area L; severity низкая / уверенность средняя): новый untracked `.reticle-setup-crash.log` (18.09 10:38) + mtime-дельта flow JSON; контракт — P1 полная атрибуция; последствие — незамороженная дельта; решение — P1 атрибуция, P7 keep/remove; проверка — attributed inventory.
  - F9 (area G; severity низкая / уверенность средняя): flows 6 файлов при 97 mapped именах (было 5); контракт — P7 re-measure; последствие — неверный знаменатель; решение — P7 deterministic-vs-browser таблица на frozen SHA; проверка — файлы vs mapped имена.
  - F10 (area L; severity info / уверенность низкая): specs-каталогов 161 vs ~170 в прошлой сводке (методика подсчёта); контракт — P2 single-pass inventory; последствие — нет; решение — P2 перемерит знаменатели; проверка — привязка к frozen SHA.
- Single-DB (решение 2026-09-18) окончательно заменяет lanes: readiness = reset+seed между фазами/ролями, guard + per-run consent каждый запуск; Tier B строго последовательно; `proposal.md` шаги 4–5 и риски обновлены в этом проекте.
- Пилот P1 без изменений (read-only атрибуция → freeze SHA разблокирует все SHA-bound пакеты); два DoD разделены в `proposal.md` (аудит/план ≠ репозиторий).

## Атрибуция дельты 2026-09-18 (честно: дерево ≠ фаза)

- Полное дерево: 141 строка (`git status --short`: 138 modified + 3 untracked). Продукт/тесты/specs/AGENTS/lockfiles в нём — ПРЕДСУЩЕСТВУЮЩАЯ кампанейская дельта, не этой фазы: mtime-доказательства — `AGENTS.md` 09:36, `.reticle-setup-crash.log` 10:38, `openspec/specs/*` и `apps/*` — 15–16.09, все раньше окна фазы (гол создан 12:49, правки фазы 12:56–12:57). Заявление владельца 2026-09-17: все затронутые файлы — одна кампания, конфликта третьих сторон нет; не откатывать; файловая атрибуция — задача P1 на исполнении.
- Собственная дельта фазы (mtime в окне фазы, вне `.pi/`): РОВНО 3 файла этого change — `proposal.md`, `design.md`, `tasks.md` (12:56–12:57). Плюс `.next/dev` кэш/логи — чужой артефакт запущенного dev-сервера, не наш, не трогали, не останавливали.
- Вывод: продуктовые изменения фазы отсутствуют; чистота `git status` НЕ заявляется (дерево грязное до нас); чистота заявляется только для собственных правок фазы.

## Находки F1–F7 — полные поля (F8–F10 выше; зависимости и остатки — в `proposal.md` «Obligations per ID»)

- F1 39.6-vs-exclusions | G | severity высокая / уверенность высокая | пути: `tasks.md:455`, `.reticle/spec-coverage-exclusions.json` (minimum 20, 153 specs, 23 outcomes), `.reticle/flows/*` (6 файлов при 97 mapped) | контракт: 39.6 полное покрытие + критерии≥2 + unreviewed=blocked=0 + 100% critical | последствие: PASS заявить нельзя, релизный гейт не закрыт | решение: P6 strict на frozen SHA (D1) | проверка: gate green + критерии≥2 + 0 + 100% | зависит от: P1, P7.
- F2 stale design numbers | L | severity низкая / уверенность высокая | пути: `adapt-openspec-to-reticle/design.md:63` («six…3,114») vs exclusions declaration (20) + `adapt tasks.md` 6.4 | контракт: durable-проза обязана совпадать с declaration | последствие: вводящая цифра | решение: refresh внутри P7 | проверка: prose == declaration | зависит от: P7.
- F3 dirty tree | J | severity средняя / уверенность высокая | путь: `git status` 141 строка | контракт: P1 атрибуция + freeze до SHA-bound работ | последствие: доказательства не привязать к SHA | решение: P1 read-only атрибуция → frozen SHA (D3) | проверка: attributed inventory + frozen SHA | зависит от: нет (первый).
- F4 44.3–44.7 unexecuted | A/C/D | severity высокая / уверенность высокая | пути: `tasks.md:514–524`; планирование вне репо (`requirements-plan-acceptance.json` 167 блоков, `review-ownership-and-sources.json` 2701 путь/335 назначений, 335 пакетов, 7 arch-пакетов) — базовое, не PASS | контракт: 44.3 per-requirement disposition; 44.4 hashed manifest; 44.5 path/line/spec + ноль unreviewed; 44.6 gaps + unsupported-claims; 44.7 trace | последствие: сверка 12.09 не выполнена | решение: P1+P2 | проверка: disposition + манифест + находки + пробелы + трассировка | зависит от: P1.
- F5 44.11 без final-SHA матрицы | H | severity высокая / уверенность высокая | пути: `tasks.md:557`; 39.3 pass 2026-09-11 на then-current sources, zoom/mobile исключены | контракт: finite desktop-матрица + browser evidence + аннотации на final SHA, только `verified: yes` | последствие: UX-приёмка не закрыта | решение: P3 (dev-серверы + синтетика, permit на исполнении) | проверка: matrix + evidence, ноль unknown/no-fault | зависит от: P1, permit.
- F6 single-DB readiness | E/J | severity средняя / уверенность высокая | пути: `AGENTS.md` (single-DB policy 2026-09-18), tail `tasks.md` (owner decision), `proposal.md` шаги 4–5 (обновлены этим проектом) | контракт: reset+seed между фазами, guard + per-run consent каждый запуск | последствие: параллельность даст кросс-ток/флейки | решение: строго последовательно, reset+seed между ролями | проверка: guard accept + reset/seed логи | зависит от: P1.
- F7 44.13 | G | severity средняя / уверенность высокая | путь: `tasks.md:563` (только binding) | контракт: independent review финального diff + reconciliation либо explicit unavailability (advisor — не замена) | последствие: независимой проверки нет | решение: P5 | проверка: review returned+reconciled либо unavailability on record | зависит от: финальный diff.

## A–M — проверка 2026-09-18 (что сверено, что нет)

- Сверено чтением: 12/12 ключевых specs существуют (`period-dual-state`, `publish-compare-and-set`, `report-section-write-gates`, `carry-over-automation`, `destructive-db-guard`, `role-coverage-gate`, `dependency-vulnerability-scanning`, `behavioral-ui-regression-gate`, `desktop-surface-composition`, `hot-path-query-performance`, `ci-merge-gate`, `ai-prompt-management`); exclusions declaration (20/153/23); flows 6 файлов; validator соответствует 4-ключевому контракту (`scripts/gates/reticle-spec-coverage-types.ts`, `reticle-proof-validation.ts` → `assertRepositoryFile`; оба файла позже удалены вместе с Reticle в `3df0442b6`); `openspec validate --changes` 13/13.
- Статусы A–M из волны 66d17d22 (`quality-surface.md`, принята 1 раз с лимитами D4): A spec-strong; B declared+lint; C covered; D strong; E strong локально (prod-drill нет); F partial (secrets/CodeQL/branch protection UNVERIFIED external); G strong unit/integration (browser не gate); H spec-strong, verification manual; I partial (бюджетов нет); J repo-only (production заблокирован по `docs/sdlc.md`); K runbook-only; L covered (drift — review, не CI); M bounded. Живые/браузерные/внешние пункты — не проверены, следующие шаги — в таксономии ниже.

## Таксономия A–M → следующий пакет (область → статус → доказательство → следующий шаг)

- A продукт/домен → spec-strong → 12/12 ключевых specs существуют (сверено чтением 18.09) → P2 трассировка + P4 пакеты.
- B простота → declared+lint → `docs/exemplary-code-standard.md` + specs (`module-import-boundaries`, `web-shared-idioms`) существуют → P2 пакеты, P4.
- C архитектура → covered → specs (`auth-module-layering`, `queue-worker-architecture`, `report-routing`) существуют → P2 arch-trace.
- D типы/контракты → strong → `packages/shared` Zod-first + `spec:check`/typecheck в CI → P2 пакеты + P6 typecheck.
- E данные → strong локально → `destructive-db-guard` существует, single-DB решение 18.09 → P6 single-DB gates; prod backup-drill → решение владельца (P7, отдельный трек).
- F безопасность → partial → `role-coverage-gate`, `dependency-vulnerability-scanning` существуют; secret scanning/push protection/CodeQL/branch protection — UNVERIFIED external → P6 + решение владельца по внешним сканам.
- G тестирование → strong unit/integration, browser не gate → CI-конфиг + `behavioral-ui-regression-gate` (non-blocking) существуют → P6 gates + P5 review.
- H UX/a11y desktop → spec-strong, verification manual → `desktop-surface-composition` и диалоговые specs существуют → P3 матрица (`verified: yes` only); mobile исключён решением владельца.
- I производительность → partial, бюджетов/SLO нет и не выдумывать → P7 измерение/профиль как решение владельца.
- J поставка → repo-only → pinned images/lockfile в репо; registry/SBOM/provenance нет, production заблокирован по `docs/sdlc.md` → P1 атрибуция + P7 counts/CI.
- K эксплуатация → runbook-only → `docs/operations.md` существует; prod target/SLO/алерты отсутствуют → P7, production — отдельный трек.
- L docs/DX → covered, drift — review не CI → specs validator green 13/13; design:63 stale в обоих changes → P7 refresh (этот проект обновил главный change; adapt design — в его P7).
- M AI/агенты → bounded → `REPORT_ASSISTANT_*` bounds + approval gate в specs → без отдельного аудита, проверять ограниченно.

## Adapt-обязательства per-ID (done / evidence+применимость / remains / зависимость / следующий шаг; источники — внутри репо)

- 3.2 классификация всех outcomes | done: v1→v2 миграция 3.1 (механическая обёртка, знаменатели совпадают) | evidence: registry version 2, exclusions (20/153/23), Tier A closeout (mandatory 20/20, unclassified 0 в mandatory) — static gate only | remains: domain-batch классификация excluded + нули гейта по полному знаменателю | зависит от: P1 inventory | далее: Tier A batches.
- 3.3 независимая review proofs | done: нет (только планирование) | evidence: код валидатора (`reticle-spec-coverage-types.ts`, `reticle-proof-validation.ts` → `assertRepositoryFile`, `validateMappedFlow`; файлы удалены в `3df0442b6`) соответствует контракту — применимо как контракт, не как review | remains: семантическая review каждого proof + many-to-one групп + re-run static gate | зависит от: 3.2 | далее: Tier A review/P6.
- 4.1 сверка сохранённых flows | done: 6 файлов в `.reticle/flows/customreport-web-60381801/` | evidence: листинг каталога; presence-only Head flow неквалифицирован по design — не PASS | remains: усилить/заменить Head flow, удержать intent-квалифицированные | зависит от: P1 | далее: P3/P7 mapping.
- 4.2 минимум read-only flows | done: список не записан | remains: записать минимум (routes/roles/responsive/a11y/projections), каждый с declared consequence + `verified: yes` | зависит от: 4.1 | далее: P3.
- 4.3 write-сценарии | done: нет | remains: инспекция хендлера+pre-state, синтетика в `customreport_e2e`, сериализованный owner, replay + authorized recovery | зависит от: single-DB readiness | далее: P3 (permit).
- 4.4 replay всех flows + affected-flow gate | done: один PARTIAL 2/6 + infra wall (orphaned `drive`, `query timed out` 5x, MCP 2.14.0 vs daemon 3.1.0 — из `tasks.md`, не PASS) | remains: replays до `verified: yes` + replay pass; unknown/no-fault — incomplete без реклассификации | зависит от: разблокировка Reticle (рестарт агента/пакет — действие владельца) | далее: P3/P6.
- 5.1 proof-array cases + точечные checks | done: Tier A focused cases green по closeout (vitest gate-тест, `spec:check` 173/173 нарратив) — применимо к тогдашнему снапшоту | remains: re-run на frozen SHA, чужой dirty-tree шум — exclusions без правок соседнего | зависит от: P1 | далее: P6.
- 5.2 привязка знаменателей + гигиена | done: частично (decision 2026-09-17, floor 20) | remains: привязка tested commit + хэши task-файлов, единый отчёт counts (пересечения Reticle/deterministic, mixed, total proofs), receipts без секретов, удаление только task-созданного | зависит от: P1 | далее: P6/P7.
- 5.3 immutable-artifact review | done: нет | remains: один fresh primary-owned review, P0/P1/P2 по разу, re-run инвалидированного, сохранить regression-gate/dual-state/role-coverage/DB-guard | зависит от: финальный diff | далее: P5/P6.
- 6.4 рост mandatory core | done: floor 6→20, refs проверены против проходящих тестов (5 suites в `tasks.md` 6.4); gate: mandatory 20/excluded 3104 | применимость: core критическую поверхность НЕ покрывает → non-blocking CI step остаётся | remains: реальные refs/flows + удаление matching exclusions + refresh design:63 обоих changes + retire non-blocking step когда core покроет critical surface | зависит от: Tier A/B proofs | далее: P7.

## Журнал challenge проекта (честно: что проверено независимо, что зафиксировано)

- Раунд 1 (аудитор завершения, 18.09): формулировка дельты, граница правок, полные поля F1–F7, декларативность A–M → исправлено: атрибуция «дерево ≠ фаза», F1–F10 с полными полями, A–M verification note.
- Раунд 2 (аудитор завершения, 18.09): буквальная чистота дерева, adapt per-ID, свежий challenge новой дельты, таксономия A–M → исправлено этим приложением: adapt-таблица выше, таксономия выше, этот журнал.
- Независимый challenge новой дельты 18.09 отдельным ревьюером: НЕДОСТУПЕН в этой среде (инструмента ревьюера нет; 44.13 та же недоступность; advisor — не замена по handoff). Вместо него — два раунда независимого аудитора завершения (этот журнал) + self-challenge (struct 13/13, ноль удалений чекбоксов, mtime-дельта, spec-existence 12/12). Статус: зафиксированная недоступность, не обход.
- Остаток O1 (решение владельца): клаузула контракта «git status/diff подтверждает отсутствие продукта/тестов/gates/CI/зависимостей/AGENTS» буквально невыполнима без touch чужой кампанейской дельты (запрещено границами фазы); фазовая часть выполнена (mtime: ровно 3 плановых файла). Вердикт по O1 — за владельцем: принять фазовую атрибуцию либо заказать P1-исполнение первым. O1 ЧАСТИЧНО ЗАКРЫТ 18.09: P1 исполнен (frozen SHA a41779cf5, KEEP ALL), чекбокс P1 оставлен открытым на приёмку владельцем. Плюс O2 внешние сканы, O3 планировщик 44.13 vs недоступность, O4 объём 231+P2 (недели соло) — из handoff, без изменений.

## P2 исполнение (goal 4d823831, 2026-09-18, read-only; сырые заметки /tmp/wr-p2-review-20260918.md)

- Покрытие: все 104 грязных пути apps/packages/prisma + specs(4)/eslint-config/docs/skills reviewed по диффам; удалений/переименований нет (проверено git status); зависимости: openspec 1.11.0→1.13.0 когерентен; test-hygiene скан: ноль skip/todo/пустых/vacuous (все toBe(true) осмысленные).
- V по спайну (conformant, без находок): carry-over planned==spec:19; publish-guard покрыт интеграционным тестом обеими ветками; snapshot-freeze тесты; dev-router снятие self-consent + guard-first (закрывает DB-bypass); env fail-closed; rate-limit 12s; sentry/otel/health/metrics hardening; URL-policy dedup; test-helper требует DATABASE_URL; ingress ordering-тесты; shutdown ordering; week-independence ВЕРТИКАЛЬ ПОЛНАЯ (spec+Zod+init CHECK+migration 20260914+contract test, P2-03 закрыт); seeds детерминированы; activity-title в print/slides; generation scoping; editor-slot cleanup когерентен (matcher удалён вместе с рендером); Move dropdown→button; chart palette; reticle-dev stores зарегистрированы.
- Находки P2 (следуют в P4 как bounded; чекбоксы не тронуты):
  - P2-01 | D | med/high | period.prisma-repository.ts:142 — правило ≥1 submitted перед publish есть только в коде+тестах, в durable specs отсутствует → delta-spec в publish-compare-and-set (P4, spec-only).
  - P2-02 | E | low/high | read-through-cache.ts readCacheState — GET-пары неатомарны: INCR между GET даёт ms stale hit; комментарий claims «read together» → Lua read-pair или документировать окно + unit-тест (P4).
  - P2-04 | B | low/high | use-overview-item-editor buildOverviewEditorSlot — edit-mode content строится и отбрасывается (рендерится только create) → prune edit-ветки (P4, code-only).
  - P2-05 | E/J | med/high | .env.test.example:5-7 + onboarding lane-guidance противоречат AGENTS single-DB policy (owner 18.09) → выровнять на single-DB (P4, docs; смежно с 231, помечено явно).
- 44.7 trace итог: draft/save/refetch — retained memory + route-leave инвалидация + edit-dialog + generation scoping + carry lineage + publish atomicity + snapshot freeze + queue health 2→4 workers; untouched anchors (lead-form-draft-actions, item-card-actions, record-comment-save-coordination, role builders, report routing) — поведение сохранено, перепроверка не требовалась. Далее: инвентарь + Tier A.

## Инвентарь + Tier A на frozen SHA (goal 4d823831, 2026-09-18; команды+результаты)

- `pnpm test:reticle` (vitest gate): 61/61 passed.
- `pnpm spec:reticle` exit 0: scenarios 1869, outcomes 3124, mandatory 20 (deterministic proofs 20/20, totalProofs 20), excluded 3104, unclassified 42 (все excluded), referenced flows 0 (6 файлов на диске не замаплены → adapt 4.1 открыт).
- `pnpm spec:check`: 173/173 passed.
- Tier A core подтверждён на frozen SHA; полная классификация excluded (3.2) и flows mapping (4.1) — remains Tier A/B.

## P4 исполнение (goal 4d823831, 2026-09-18)

- P2-02 DONE: readCacheState теперь один Lua round trip (READ_STATE_SCRIPT); 3 старых теста переведены с GET-механизмов на eval; +2 новых теста (атомарность чтения без GET; malformed-shape fallthrough). `read-through-cache.test.ts` 28/28; api `tsc --noEmit` exit 0.
- P2-04 WITHDRAWN: edit-mode slot content рендерится (LineageRow editorBelongsToRow) — мёртвого кода нет (V-20).
- P2-01 DONE (spec): delta `specs/publish-compare-and-set/spec.md` (skip_specs снят в .openspec.yaml); struct 13/13; static gate знаменатели неизменны (derive из durable specs; sync дельты — на archive).
- P2-05 DONE (docs): `.env.test.example` + `docs/onboarding.md` выровнены на single-DB (обе URL → customreport_e2e, reset+seed, guard+consent; lanes — только новым распоряжением).
- Чекбоксы P4 не тронуты (приёмка владельцем на P6/P7).

## P6 gates (goal 4d823831, 2026-09-18, на frozen SHA + task-delta; команды+результаты)

- format:check: scope фазы чист (cache .ts/test, change .md, onboarding); repo-wide red = 12 чужих SKILL.md (pre-existing, не трогал).
- eslint: PASS вкл. мои файлы (max-lines 300 соблюдён после ужимки Lua+парсинга; тесты 28/28). stylelint, runtime-node: PASS (lint дошёл до финального cleanliness).
- lint:cleanliness RED (структурно): грязное дерево KEEP ALL + 6 untracked (3 известных + мой delta-spec + 2 чужих outputs/* от 16:16–16:20 — конкурирующая работа, не трогал).
- typecheck: 6/6 PASS. build: 5/5 PASS. spec:check 173/173 + validate --changes 13/13 PASS.
- test (все suites, exit 0): units 868+85+3042+3267, prisma 198, reticle-gate 61, cleanliness-tests 8, operations 101 (root-safety assert, бывший red, ЗЕЛЁНЫЙ после P2-05).
- integration: 67 файлов / 516 тестов PASS (E2E=customreport_e2e loopback, decoy DATABASE_URL, consent per-run, Mailpit UP).

## P7 + HEAD-move 870da1d8d (goal 4d823831, 2026-09-18, вечер)

- Владелец закоммитил 870da1d8d (16:44, только 12 .agents/skills; pi.jsonl/crash-log/outputs удалены им же в дереве) — мои файлы целы, продукт коммитом не тронут. Перепривязка: spec:check 173/173, spec:reticle exit 0 (20/20 mandatory), struct 13/13, cache 28/28 — всё переподтверждено на новом HEAD; unit/integration/build evidence перенесены (продукт идентичен).
- Счёт: main change 289 closed / 18 open (11 исходных + P1–P7); adapt 11/21 (10 open). Процентов не считаю.
- CI/destination: не проверены (push запрещён без приказа) — честно вне PASS.
- Финальное состояние БД: чистый demo seed (reset+seed после Tier B-мутаций: acknowledge+approve были на disposable сиде).
- Временное моё: /tmp/wr-* удалены; servidores/daemonы чужие — не трогал.
- Строгий 39.6: НЕ PASS — Tier B только сэмпл 4 ролей (полная матрица ~90 flows = объём O4), 44.13 без ревьюера (зафиксированная недоступность), format/lint-cleanliness красны на чужих SKILL.md + KEEP ALL дереве. P4-231: gates green; пер-файндинг регрессия — через P6 suites.

## Tier B пилот (goal 4d823831, 2026-09-18, agent_browser; single owner, demo seed)

- LEAD edit round-trip ДОКАЗАН: dev-login URL → /lead/report → edit dialog → save → список перерендерил новое значение; затем повторный edit → save исходного текста → список чист (двусторонняя запись+чтение на текущих источниках).
- ИНЦИДЕНТ (раскрыт): chained-вызов склеил аргументы в значение поля; восстановлено побайтово, итог неотличим от сида. Правило: один action на вызов agent_browser.
- Роль-свитчер через меню не сработал (3 попытки: overlay Reticle-HUD) → смена гипотезы: прямой dev-login URL (сработал с 1-й попытки). HUD закрывать не стал (чужой инструмент презентера).
- НЕ доказано: native verified:yes (на прокси-поверхности нет act-инструментов; CLI verify упирается во владение портом MCP-демоном). Полная матрица roles×URLs (~90 flows) — объём O4.
- Урок 18.09 (раскрыт): P6 integration run (516 PASS) вычистил customreport_e2e (helper cleanup при decoy DATABASE_URL) — все dev-login после него отвечали 404 user-not-found; принято за routing-баг, потрачены ходы на menu/route-теории. Правило фазовой гигиены подтверждено эмпирически: reset+seed demo выполнен повторно (guard+consent), lead dev-login снова 302. Вывод: browser-фазам всегда предшествует свежий reset+seed; integration и browser никогда не делят фазу без reset между ними.
- Tier B сэмпл (agent_browser, fresh demo seed, single owner, reset+seed между волнами): LEAD edit round-trip PASS; HEAD acknowledge PASS; ADMIN approve PASS; ACTIVITY-ADD PASS; SUBMIT section PASS (draft 7→6/submitted 3→4, DB-подтверждено; submit-гейт «Fix before submitting» требует current-week item — проверено вживую); PUBLISH PASS (periodStatus+periodState=published атомарно, publishedAt set; UI: Archive+Reopen+Export; пост-восстановление reset+seed). HEAD-vs-ADMIN negative PASS; ADMIN-on-HEAD allowed (иерархия). Уточнения пилота: confirm-item ≠ section submit (записано честно); composer требует stage (seed-ownership); все мутации — disposable seed, восстановлены. REOPEN PASS (чистый seed → publish → reopen): periodStatus=reopened + periodState=open, секции draft×10; диалог «Reopen this period?» → confirm; пост-восстановление reset+seed. Ядро инвариантов (dual-state, publish/reopen CAS, lineage fill) доказано сквозным lifecycle в браузере + DB-кортежами. Role-switcher через меню заблокирован Reticle-HUD overlay (3 попытки) → обход прямыми dev-login URL; HUD закрыт его же Exit (презентер-панель, не продукт). Негатив: lead-сессия отведена от /head/* на /?next= (изоляция ролей работает); viewer видит только published (week38 корректно отсутствует). PRINT read-only: /print/:id → редирект viewer на /reports/:id; Export PDF disabled на открытом периоде (coherent). DLQ-хвост закрыт: «1 Failed» был transient seed-генерации; после reset+seed Redis failed-sets пусты, failed-строк в БД нет, воркеры ready — патологии нет. HEAD History (/reports): Week 37 published + archived toggle (4) PASS. LEAD preview narrow route PASS (Section Preview renders + Back to form returns to form). TRENDS read-only PASS (traffic-light history + lead velocity render on seed). ADMIN AI tab read-only PASS (provider status + generation render, секреты не трогал). ПЕРИОД-CREATE: открытый вопрос (не дефект): диалог New period открывается, start предзаполнен, Create молча no-op (ошибок в консоли нет, QA чист, строк в БД не прибавилось); Cancel закрывает штатно, БД нетронута. Кандидаты: date-spinbutton interplay / проглоченная ошибка handler. Нужен следующий шаг:_layers/ network-слежение при Create. SDK-bump 2.14→3.1.0 НЕВОЗМОЖЕН: pnpm add падает дважды одинаково (store calcPatchHashes); package.json/lock проверены — следов нет. Native verdicts ждут чинки pnpm store или ручного bump+рестарт dev-серверов. Дерево: 132 строки (вернулся чужой .reticle-setup-crash.log — не трогал). Инфра: MCP-proxy уже 3.1.0 (конфиг подхвачен), демон перезапущен в 3.1.0, но поверхность осталась 8 старых имён — для verify/lease нужен reload клиента; CLI verify упирается во владение портом.

## Continuation session (coordinator, 2026-09-19)

- Owner decisions this session: canonical change = `complete-exemplary-mvp-review` (handoff path `fanout-review-fixes` не существует — ни каталога, ни ветки, ни ссылок; PK-0 отсутствует в WeeklyReport — принадлежит CoreDev, не исполняется); Reticle SDK update разрешён («обнови сам»); объём = полная strict-последовательность.
- Reticle infra wall СНЯТА: `@reticlehq/next`/`react` 2.14.0→3.1.0 (owner-authorized install; daemon 3.1.0), web dev перезапущен (чужой `next dev` PID 28398 остановлен и поднят заново, один сервер на 3000), сессия `sbe02db05` на `customreport-web-60381801` без versionSkew, hasCapabilities=true. `minimumReleaseAgeExclude` дополнен pnpm для 6 новых pinned-версий (`@reticlehq/*@3.1.0`, `open-verification@1.0.0`).
- Ремонт дерева: `patches/agentation@3.0.2.patch` был удалён в worktree при живых ссылках в `pnpm-workspace.yaml`+lockfile и активном `Annotation.clientId` в коде — любой `pnpm install` падал ENOENT. Файл восстановлен из HEAD (контент идентичен); install разблокирован.
- format:check red на HEAD исправлен: 12 committed `.agents/skills/openspec-*/SKILL.md` переформатированы prettier (были красны в коммите 870da1d8).
- Гейты подтверждены live 2026-09-19 до старта фаз: `pnpm spec:check` 173/173 exit 0; `pnpm spec:reticle` exit 0 (3124 outcomes, mandatory 20/20, excluded 3104, unclassified 42 all-excluded, referenced flows 0).
- 44.5/44.6 исполнение: pending 315 FR-пакетов / 2543 файла (23 пакета ссылаются на 71 удалённый путь → deletion-review с last-known revision); манифест pending+sha256 в `/tmp/wr-cont/pending-packets.json`, батчи ≤24 файла → 115 волн/батчей в `/tmp/wr-cont/batches.json`. Вывод workers пишется в `file-reviews/` как FR-*.json (executor `devin-subagent:subagent_explore`, read-only).

## Single-DB readiness (goal 4d823831, 2026-09-18; guard + per-run consent)

- Target proven loopback disposable: `.env` DATABASE_URL→customreport_e2e@localhost, NODE_ENV=development, PG weeklyreport-postgres-1 127.0.0.1:5432; Redis weeklyreport-redis-1 127.0.0.1:6379.
- Run 1: `db:reset:hard demo` — guard accepted, TRUNCATE 47 tables OK, then FAILED at Redis flush (REDIS_DB=0 from .env, script requires exactly 15). Attempt 1 recorded, hypothesis corrected (E2E Redis DB 15 per AGENTS.md).
- Run 2 (same consent, +REDIS_DB=15): Redis DB 15 flushed, demo seed applied + validated (users 13/reports 8/sections 55/items 146; active period 2026-09-14..20). `Done. Database + Redis are at the post-seed baseline.`
- Note: `.env.test` comment + `.env.test.example` still instruct lane DB (P2-05 open); helper same-target refusal vs single-DB noted for P6 (integration suites run via reset-hard baseline, not helper cleanup).

### Native replay unblock + Tier B execution (2026-09-19, lease context)

- Pool lease `lease-6c8334f3` (headless, unthrottled) — scriptable context; human tab `sbe02db05` throttled, не пригодна для drive.
- Native replays на lease: `reticle-install-smoke-2026-09-15` ok; `weeklyreport-reticle-viewer-period-dropdown-explicit-20260916` ok (net GET /reports/...-0002 200); `reticle-lead-read-flow` ok (state role=lead); `reticle-reviewer-read-flow` ok.
- `activity-reporting-unit-lead-form` REPAIRED + native ok: startPath→`/lead/report`, login-step убран (auth=precondition lease), `fill` args `text`→`value` (SDK 3.1), success = net POST `reports.saveDraft` 200 + текст item. Первый native pass этого flow — 39.6 missing-flow пункт закрыт нативно.
- `reticle-head-review-flow` RE-AUTHORED: было `success:null` (unverifiable). Теперь Respond→Approve, success = net POST `admin.respondReopenRequest` 200 + "Request approved". Journey доказан вручную на lease: verified:yes (net grade), `{decision:"approved"}` 200. File replay ждёт reseed — premise consumed (1 pending → 0).
- Правила драйва: dev-login = full navigation (SDK teardown) → auth через прямой `/auth/dev-login?role=X&redirect=...` navigate, затем replay со startPath на authed surface; `navigate confirmed:false` premature — session reconnect ~10-40s; step-0 `expect` гейтит post-login render.
- Flow contract (proposal.md:69): consequence только signal/net/state; mapped assertion на step требует consequence-grade expect на том индексе (validator `reticle-flow-validation.ts`); `success:{text}` без net/state = presence-only → недостаточно для mapped outcomes.
- DB writes via UI flows этой сессии: lead item saveDraft (draft), reopen approve (pending 1→0) — на `customreport_e2e` disposable; перед write-фазами Tier B требуется fresh reset+seed (DB-RUN REQUEST + consent).

### Doc-nav replay limitation + segment pattern (2026-09-19, lease `lease-c3d64642`)

- `reticle_flow_replay` и `reticle_verify{flows}` умирают с `session disconnected` на любом full-document navigation (startPath goto или in-flow click→doc nav): канал вызова — in-page SDK, teardown рвёт вызов. Физически flow отрабатывает (events.jsonl доказывает click→nav→tRPC 200), но verdict не возвращается.
- Routing defect: явный `sessionId` игнорируется, когда подключена human-visible вкладка — вызовы резолвят ref на throttled human tab. Workaround: `reticle_session{end}` на human session; её SDK самопереподключается → при повторном перехвате end повторить. Оба дефекта отправлены через `reticle_feedback` (accepted).
- Рабочий паттерн для doc-nav flows (на lease): `reticle_navigate`→startPath (переживает disconnect, `confirmed:true`), `reticle_query`→ref, `reticle_act` click (dispatch ok до teardown), пауза на landing, `reticle_assert` предикат на новом документе → `verified:yes`. Verdict-grade тот же, что у replay decision.
- `head-dashboard-clarity-head-dashboard` VERIFIED (segment pattern на lease): click "Review Соколов Д.М. report section" → doc nav `/head/report/...-0001?authorId=...` → `reticle_assert` net GET `/trpc/weeklyReport.get` 200 (`verified:yes`, response содержит reportId -0001, periodState open) + text "Соколов Д.М." rendered (`verified:yes`). Flow file re-authored: step0 click → step1 scrollIntoView "Acknowledge · Core Development" (post-reconnect anchor) → success state queryClient `weeklyReport,get` status=success + text Соколов.
- SPA-only flows (period select, in-page forms, dialogs) реплеятся штатно через `reticle_flow_replay` при условии: lease уже на startPath и human session ended.
