# Design

## Context

See `proposal.md` and `specs/behavioral-ui-regression-gate/spec.md` for scope
and acceptance. Lead authoring lives under
`apps/web/src/features/report-pages/ui/lead/`; Overview and its support
sections reuse the canonical item, Risk and Decision editors, draft coordinator
and reviewer feedback. Imported toolbar and Slides controls are part of the
capability inventory.

The owner selected installed `agent-browser` CLI 0.38.1 with TypeScript
`node:test`. The preparation stage prohibited browser execution, database/Redis
access and reset/seed while the owner's site occupied the target; its static
checks did not establish browser acceptance.

On 2026-09-30 the coordinator handed over exclusive `customreport_e2e` and
Redis DB 15 use for live correction and acceptance. The runner was rebased to
`94efe4f6e`; the existing web/API processes on ports 3000/3002 run application
main `33d853b6a` from `/Users/wrk/work/weeklyreport`. Do not stop or restart
those processes. Complete browser acceptance remains NOT VERIFIED pending the
final full-run evidence; selected results are recorded separately below.
The final handoff must restore the canonical full dataset through the
guarded `pnpm db:reset:hard full` command from that application checkout.

## Goals / Non-Goals

**Goals:** Named source coverage, independently prepared browser scenarios and
one separate native Node acceptance command using the selected browser CLI.

**Non-Goals:** Product/API/schema changes, another browser adapter, a custom
test framework, server orchestration, new database lanes, adding browser tests to CI,
remote provider execution or external publication. A Head browser session joins
the same test's Request changes, approval/rejection of Lead Request reopen, or
period publication/reopen needed to establish the Lead's published-lineage
controls in S13. This does not add a general Head regression suite.
Use native subagents for delegated work; do not use Devin for this task.
The current owner instructions also require independent review of the final
SHA by a different model, including ponytail review, and successful remote CI
for that same SHA before claiming complete acceptance. Push remains forbidden;
unavailable CI must be recorded as NOT VERIFIED for coordinator handoff.

## Decisions

### Root `e2e/` owns cross-application acceptance

Keep `e2e/lead-form/` at the root because scenarios join web UI, API auth and
review, the shared database guard and Prisma fixture preparation. Colocating
them with Web Vitest tests would misrepresent ownership. Keep `COVERAGE.md`
beside `*.test.ts` scenarios, include the tree in `e2e/tsconfig.json`, and
declare its real Node test/setup entrypoints to Knip without broad ignores.

The owner replaced Playwright Test on 2026-09-30 to keep `agent-browser` as the
single browser automation route across agent harnesses, consistent with the
2026-09-20 decision in [AGENTS.md](../../../AGENTS.md#browser-verification).

Use the installed `agent-browser` executable and built-in `node:test`, with
the existing `tsx` loader. No dedicated browser test dependency or runner
configuration is needed. `pnpm test:e2e` is exactly:

```text
node --import tsx --test --test-concurrency=1 e2e/lead-form/*.test.ts
```

Each independent test file registers the explicit `node:test` hooks from
`e2e/lead-form/fixtures.ts`: `before(globalSetup)` invokes
`e2e/setup/global-setup.ts` to validate configuration and initialize the owned
session base without resetting data; `beforeEach` prepares that test's baseline, and
`afterEach` closes its owned sessions. The runtime-only shutdown handler is
installed before global preparation. There is no separate runner wrapper.
Before each destructive preparation, `beginTestSessions` verifies that the
previous test left no owned browsers open; failed strict close blocks the next
reset in that worker.
Keep `pnpm test` and `.gitlab-ci.yml` unchanged. Serial Node execution prevents overlapping resets
of the shared target; per-test preparation provides isolation. Use native Node
test reporting and put optional snapshots/screenshots/logs under
`node:os.tmpdir()`; repository runtime artifacts remain forbidden.

### Use a thin wrapper around real CLI commands

`browser.ts` delegates through `node:child_process` `execFile` with an
argument array and explicit environment, never a shell. Keep only methods that
scenarios use: `open`, `findRole`, `fill` by accessible label, `waitText`,
`getText`, `isVisible` and `snapshot`, plus necessary native actions and
owned-session cleanup. Their implementation must follow the actual CLI help
and core skill rather than a parallel locator API. Do not import a browser SDK
or reproduce another driver's page/context/network objects.

Only at authorized runtime setup, create the named session with the CLI command:

```text
agent-browser session id --scope worktree --prefix e2e-${timestamp}-${pid}
```

Derive fresh Lead and Head session IDs per test from that worktree-scoped base
and pass the selected ID as `AGENT_BROWSER_SESSION` to each CLI command.
The second owned channel normally authenticates as Head for reviewer actions.
The concurrent-edit scenario instead authenticates that channel as the same
Lead through dev-login; session suffixes name channels, not authenticated roles.
Close only the owned sessions on completion or failure, using a
separate cleanup context that remains usable after the test signal is aborted.
There is no browser launch or session creation during static checks.

### Inventory and source boundaries remain explicit

`COVERAGE.md` records capability IDs, current source paths, conditions and
exact final Node test titles. Inventory imported child controls as well as the
Lead folder: every Overview action, section editor, priority/status,
completion, limits, feedback, navigation and viewing control. An implemented
scenario is not a runtime PASS.

The revised inventory contains 123 authored browser cases. Item, Risk and Decision
required-field/discard contracts use three independent cases: the existing
`canonical record dialogs validate required fields and discard unsaved changes`
retains Item, and the new `risk dialog validates required fields and discards unsaved changes`
and `decision dialog validates required fields and discards unsaved changes`
were inventoried before implementation and are now authored. The independent
run8 result is exit 1, 2 pass / 1 fail: Risk and Decision pass, while Item leaves
focus on `MAIN` after dirty Discard. Each receives its own guarded baseline,
so that failure does not prevent exercising the other editors. The defect
reproduces with a verified focused Edit opener activated by native pointer
in `run8/selected.log` and by native Enter in `run8/keyboard-focus.log`.
After modal closure and the 25-second observable wait, exactly one expected
opener remains connected and visible; the keyboard-only case exits 1, 0 pass /
1 fail. Earlier evidence remains in the two run7 focus logs. Current explicit
record opening uses native focus plus Enter. Keep the strict assertion failing
and report the defect; this regression does not change product code or restore
focus through test scripting. Complete 123-case acceptance remains pending.

The public form has Report/Overview and Slides; `mode=edit` normalizes rather
than opening a third route. Week-item Delete exists in the Slides canonical
editor, while its Overview counterpart has no Delete callback. Priorities
are Item projections. Product/Activity catalogue CRUD is not a Lead action.
The standalone record-count limit modal is absent, but the item-count limit has
a real visible error path. A historical prior-plan resolution into an own
section already containing 100 items is rejected by `resolvePlanTx` with
`This section has reached its item limit.`; `use-overview-plan-actions.ts`
retains the input and `overview-plan-composer.tsx` renders that exact alert.
The authored case, `historical plan item limit retains input without changing saved work`,
asserts two genuine rejections, retained composer input and unchanged saved
Current/Next/history after cancellation and reload. Its inventory entry preceded
implementation. It passed in the selected `run5/selected.log`; that run's
10 pass / 5 fail result does not establish full-suite acceptance.
The historical WR-041/F08 "limit dialog" refers to 500-character validation in
the canonical ItemEditDialog, covered separately by the real field-boundary
cases. A Product with no author stage assignment is filtered out by the
backend; the zero-owned-stage defensive panel is N/A for valid public data.
Never synthesize a selectable zero-stage Product to manufacture coverage.

Previous's historical occurrence is immutable and has no edit, move, confirm
or status control. For lineage without a matching Current occurrence,
`Plan this work` may create active work in the selected editable section
without changing Previous or its authoritative snapshot.

### Reuse guarded reset and independent baseline preparation

Each test's `beforeEach` uses the guarded demo reset/seed/overlay path; the
file's `before(globalSetup)` does not reset or seed. Require explicit matching `E2E_DATABASE_URL`/`DATABASE_URL`
targets, exact loopback `customreport_e2e`, non-production environment,
`REDIS_DB=15` and
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'`.
Refuse lane targets even though the guard accepts them for other tasks, and
log only a credential-masked target.

Preparation validates through `prisma/guards/_destructive-guard.ts` and runs
the entire reset+overlay flow in one owned child process group, with
`E2E_DATABASE_URL` mapped to that child's `DATABASE_URL`.
`e2e/setup/reset.ts` owns
`prepareE2eData(profile: "demo" | "minimal", signal: AbortSignal, scenario?: "archived-fill-only" | "section-item-limit")`
and launches
`e2e/setup/prepare.ts`; native global/beforeEach hook contexts pass their
`context.signal`. This child runs `prisma/operations/reset-hard.ts` with the
selected profile and `tsx` loader, using ordinary non-detached descendants
that inherit the owned group, then runs the demo overlay in that same group.
The parent awaits child close before proceeding and performs no Prisma overlay
writes. This reuses the underlying `db:reset:hard` workflow: apply migrations,
truncate application data, sequentially SELECT/FLUSH Redis15, and explicitly
seed demo. Per-test preparation then applies the same narrowly
guarded overlay for historical/open-work states, a Product with one owned
stage, an owned reviewer comment and foreign private comment/note/reason
sentinels. Preserve canonical seed/Prisma shapes and predecessor semantics;
the overlay is not a second base seed. The explicit Next fixture updates the
existing carried Current item's `nextStepText`; it never inserts a second Item
with the same `(reportSectionId, stableId)` lineage key.

Canonical minimal-state and S13 published-lineage scenarios call
`prepareE2eData("minimal", context.signal)` without an overlay. The explicit
F01 archived-picker/empty-source condition calls
`prepareE2eData("minimal", context.signal, "archived-fill-only")`. Only this
minimal-profile variant invokes `e2e/setup/archived-fill.ts` in the same owned
preparation group to add a schema-valid archived published own-Lead Planning
source and its frozen published snapshot. Both parent and child reject the
variant with another profile before spawning/resetting respectively. Ordinary
demo and minimal baselines remain unchanged; each selected scenario creates
its own source rather than inheriting another test's history.

The item-count scenario explicitly calls
`prepareE2eData("demo", context.signal, "section-item-limit")`. That variant
accepts demo only, reuses the canonical demo seed plus normal overlay and fills
the expected owning Lead section to exactly 100 schema-valid uniquely identified
items. Both parent and child validate the variant/profile before reset; the
fixture passes the destructive guard and checks expected owner/baseline count
before mutation, then asserts the exact final count. All writes remain in the
same owned cancellable preparation group, never in the browser/test process.
Normal `beforeEach` still performs one ordinary independent demo reset; this
specialized case prepares its explicit count condition in its body, just as the
existing minimal variants do. It neither adds a second unconditional global
reset nor inherits another test's filled section.

Abort, timeout or preparation failure must stop and reap the entire owned
preparation group, including overlay writes and ordinary reset descendants,
before another test starts. An in-process overlay must not outlive a cancelled
hook. This cleanup does not target the coordinator's application processes.

`e2e/setup/shutdown.ts` installs runtime SIGINT/SIGTERM handling before the
first preparation. Its terminal abort blocks further preparation or browser
commands, waits for tracked preparation and CLI clients to settle, closes owned
sessions through independent cleanup and removes the task-owned temporary CLI
configuration before exiting 130/143 respectively. A close rejection must not
skip configuration removal; cleanup failures remain explicit. The pure contract in
`e2e/setup/shutdown.test.ts` uses synthetic Node children; it does not exercise
the database or browser.

Each scenario makes additional state through its own UI. A selected test
receives the same baseline without prior test mutations or leaked session
cookies. Preparation is invoked explicitly at runtime, with no service access
or browser command at module import time.

### Assertions observe real outcomes

Find controls through roles and accessible names; scope repeated names through
current snapshots and semantic containers supported by the CLI. Fill ordinary
fields through accessible labels. Native `Deadline` inputs cannot use the
ordinary fill/IME route: discover their real ARIA spinbutton ranges, resolve
fresh scoped references, use native click/focus for each segment and press individual digits.
Read the label-associated control's ISO value before Save and when clearing
the date; do not assume English accessibility names or date-segment order.
Avoid CSS classes, test IDs, fixed sleeps and scripted DOM mutation. Read-only
DOM evaluation may assert the actual control value. Use the CLI's own
wait/assertion facilities, snapshots, text/state reads and saved-content reloads
to observe results.

Native `summary` nodes can appear as `DisclosureTriangle` in Chromium's AX
snapshot; that native tree role is not an ARIA role. The installed CLI supports
its native `find role DisclosureTriangle ... --name ... --exact` command, and
some summary nodes have no snapshot reference. Assert exact named scope counts
and use that supported native finder when no reference is available; use fresh
observed references for referenced controls. Structural scope nodes may also
lack references. Do not invent a button alias or require refs on every scope.

Chrome AX exposes the Overview headings as `PRODUCTS` / `PROJECT ACTIVITIES`
and its date-bearing week-group prefixes as `PREVIOUSLY PLANNED`, `CURRENT WEEK`
and `NEXT WEEK`. These observed names differ from title-case radio/form labels.
Scope Report/Slides links to the named View mode group because Main navigation
also contains a Report link.

Use the shared `snapshot-scope.ts` parser and `helpers.ts` functions rather than
parallel local implementations. The CLI has no role-wait command, so shared
`waitScope`, `waitClosed` and `waitButton` poll observed AX snapshots within a
bounded deadline without fixed sleeps. For ordinary scopes, `waitScope` returns
the matching snapshot. For dialogs and alertdialogs, it additionally awaits the
actual role/name, no running surface animations and a center hit target inside
the dialog, then returns a fresh AX snapshot. This read-only readiness check
does not force or retry clicks. Expandable
support sections await their actual `aria-controls` panel's platform
`getAnimations()` completion before interacting with controls in its moving
layout; no elapsed-time sleep substitutes for completion.

Decode the observed complete tRPC `{ json, meta }` envelope with the application's
existing `superjson` 2.2.6 catalog dependency before applying the canonical
`draftSaveSchema`; reading only `json` loses serialized values. Its root
development dependency reuses the application serializer, not a browser adapter.

Fullscreen controls are siblings of the slide deck. In the settled fullscreen
AX tree only the floating `Exit fullscreen` button is exposed; the ordinary
toolbar button outside the fullscreen host is excluded. Wait for native
`document.fullscreenElement` and the matching AX button, then assert exactly
one visible Exit pill with `aria-pressed=true` and no Enter button. Exiting
through its native click, Escape or the `f` shortcut must restore the ordinary
toolbar Enter button with `aria-pressed=false` while preserving slide selection.
The positive shortcut uses sequential native `keydown f` and `keyup f` commands,
with each observable fullscreen transition awaited before the next pair. The
saved keyboard probe records trusted events and real entry/exit; no batch or
scripted keyboard event is needed.
The saved fullscreen probe shows the transitional two-button AX tree settling
to one; do not scope the floating Exit to the deck or demand both toolbar controls.

Dev-login and happy-path persistence use real UI/API flows. Head Request changes
uses the real comment dialog in the same test; Head approval/rejection of a
Lead Request reopen also belongs to the same scenario. Assert the exact reason,
returned editability or retained submitted state after a reload.
S13 builds published lineage through real minimal-baseline Lead submit and
same-test Head Publish & Lock/Publish Anyway and Reopen Period/Reopen actions,
then asserts the Lead's permitted edits and forbidden destructive deletion.

Concurrent-edit recovery uses two real Lead logins. The first session stays
offline with its loaded version while the peer saves and reloads an acknowledged
update through the UI. Reconnecting its stale save must yield a real HTTP 409
`CONFLICT`, refetch the peer's content and retain the first input in disabled
recovery; cancelling recovery must leave the peer's saved content intact.
Touch navigation opens the Reporting period listbox and checks its observed
bounds contain the CLI's entire native swipe path from (200, 400) before a
100-pixel swipe. In CLI 0.38.1 the native handler has an Appium branch followed
by a Chrome CDP `Input.dispatchTouchEvent` branch; the iOS wording in help does
not establish that Chrome is unsupported. The selected N13 run in
`run2/navigation-last-three.log` passed both directions with URL/selected-option,
historical read-only and no-report-POST assertions. This selected result does
not prove full-suite acceptance; the final complete run remains separate.

A save failure may be reproduced only through a verified native CLI network
control, with retained input and a successful real-backend retry. Identify
fault injection; if no supported path is reproducible, record the precise
coverage limitation rather than add an alternate adapter. Assistant scenarios
use the browser CLI's network controls to stub the application's tRPC responses
for availability and assistant outcomes. These are response stubs at the UI's
tRPC boundary, not backend AI-provider stubs; they avoid remote or paid requests
and prove local UI behavior without claiming provider integration.

Production data flow is unchanged:

```text
Lead control -> canonical editor/draft -> existing tRPC -> guarded write -> DB
Head dialog  -> existing review tRPC   -> verdict + comment + return to draft
Head response -> existing reopen tRPC  -> approved/rejected request + section
```

The authorized acceptance flow is:

```text
coordinator handoff -> validate exact target + consent + Redis15
  -> native node:test command, files run serially
     -> each file: before(globalSetup), validation + owned session base, no reset
     -> each test: beforeEach, prior owned browsers closed -> fresh IDs -> demo preparation
        -> minimal conditions/S13: guarded minimal reset/seed, no overlay
        -> F01 archived condition: minimal + explicit archived-fill-only source
        -> O18 count condition: demo + explicit section-item-limit fixture, exactly 100 own items
        -> real CLI/UI interaction -> snapshot/refetch assertion
        -> afterEach: close own sessions through independent cleanup context
     -> cancellation: stop/reap the owned reset+overlay process group
     -> SIGINT/SIGTERM: terminal abort -> await owned clients + cleanup -> 130/143
  -> final full guarded reset/seed from the application checkout
```

### Runtime prerequisites and preserved invariants

The coordinator supplies existing source web `http://localhost:3000` and API
`http://localhost:3002` with matching exact database targets,
`AUTH_DEV_MODE=true`, `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` and Redis15.
The current handoff explicitly forbids stopping, restarting or launching
servers. Readiness does not establish the app clients' selected Redis database.
Dev-login must use each fixture email's native role.

No application middleware or write path changes. Fixtures retain complete
period lifecycle tuples and stable lineage. Previous/snapshots stay immutable;
historical replanning writes only the selected editable target. An explicit
Next commitment uses the existing Current occurrence rather than duplicating
the section/lineage unique key. Guarded
reset/seed/overlay have no URL or consent bypass.

## Risks / Trade-offs

- The shared target is exclusive only for the coordinator-authorized live task;
  use no lane database or Redis DB 0 and restore the full seed before returning it.
- CLI semantics differ from SDK locators -> inspect actual help/core skill and
  implement only real commands; unsupported coverage remains explicit.
- Conditional controls require fixture states -> use the narrow guarded overlay
  and bind every covered condition to source and a Node test title.
- Preparation can still write after a hook abort -> contain reset and overlay
  in one owned process group and finish its cleanup before the next test;
  browser cleanup uses an independent cancellation context.
- Static gates cannot prove visible flows -> record four exit codes separately,
  then the complete browser run's exit code and pass/fail counts. Keep unrun
  cases pending and report reproduced product defects without weakening tests.
- Provider/failure interception may be unavailable -> never compensate with
  remote paid calls or a second browser adapter.
- Default browser runtime limits platform coverage -> no claim for other browser
  engines, production build behavior or SAML sign-in.

## Migration Plan

Replace the task's earlier test runner/dependency/configuration with the native
Node suite and CLI wrapper; keep product/database source unchanged. Validate
the revised OpenSpec before implementation. The preparation stage completed
static checks and a local commit with runtime deferred. After rebase, correct
imports removed by main cleanup, verify current CLI/selectors and remove
duplicated helpers and the redundant global reset. Run selected files as
needed, then the full `pnpm test:e2e` suite; retain failure evidence outside the
repository and distinguish scenario errors from reproduced product defects.
Re-run the four required static gates, restore the canonical full seed with
exit 0, and record final source SHA, browser counts and restoration in the
external report. Commit task-owned changes with the required Conventional
Commit subject and Codex coauthor; obtain the required different-model review
including ponytail against the final SHA. Record same-SHA remote CI as NOT
VERIFIED until the coordinator provides its successful result; do not push or
archive prematurely.
