# Design

## Context

See `proposal.md` and `specs/behavioral-ui-regression-gate/spec.md` for scope
and acceptance. Lead authoring lives under
`apps/web/src/features/report-pages/ui/lead/`; Overview and its support
sections reuse the canonical item, Risk and Decision editors, draft coordinator
and reviewer feedback. Imported toolbar and Slides controls are part of the
capability inventory.

The owner selected installed `agent-browser` CLI 0.38.1 with TypeScript
`node:test`; the suite fails fast unless `agent-browser --version` reports that
version. It runs against the already running web/API (ports 3000/3002) and the
exclusive `customreport_e2e` database with Redis DB 15, and never starts or
stops the application. Browser acceptance is a full `pnpm test:e2e` run; its
evidence stays outside the repository.

## Goals / Non-Goals

**Goals:** Named source coverage, independently prepared browser scenarios and
one separate native Node acceptance command using the selected browser CLI.

**Non-Goals:** Product/API/schema changes, another browser adapter, a custom
test framework, server orchestration, new database lanes, adding browser tests to CI,
remote provider execution or external publication. A Head browser session joins
the same test's Request changes, approval/rejection of Lead Request reopen, or
period publication/reopen needed to establish the Lead's published-lineage
controls in S13. This does not add a general Head regression suite.
Final-SHA review by a different model and green same-SHA CI are required
before claiming complete acceptance; local gates do not replace either.

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
Keep `.gitlab-ci.yml` unchanged; `pnpm test` adds only the browser-free `test:e2e-setup` contract suite. Serial Node execution prevents overlapping resets
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

Only the CLI `open` child-process bound is 180 seconds; other commands and close
retain 40 seconds, and the cleanup hook retains 45 seconds. CLI 0.38.1 `open`
has no `--wait-until` option: its native load/cold-start behavior includes a
25-second load wait, a 30-second cold startup and up to five 30-second socket
attempts (about 152 seconds for those attempts). The outer open bound accommodates
that native policy; the wrapper adds no sleeps or retries. Observable AX/URL
readiness still uses the unchanged 25-second waits and strict assertions.

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

The inventory contains 123 authored browser cases. Item, Risk and Decision
required-field/discard contracts use three independent cases: the existing
`canonical record dialogs validate required fields and discard unsaved changes`
covers Item, and `risk dialog validates required fields and discards unsaved changes`
and `decision dialog validates required fields and discards unsaved changes`
cover the other two. Each receives its own guarded baseline,
so one failure does not prevent exercising the other editors. The Item case
asserts that focus returns to a connected, visible Edit opener after dirty
Discard; current explicit record opening uses native focus plus Enter. The
regression never changes product code or restores focus through test scripting.

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
Current/Next/history after cancellation and reload. The historical WR-041/F08 "limit dialog" refers to 500-character validation in
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
does not force or retry clicks. `scopedRef` reuses `waitScope` before reading
the scoped target; direct dialog snapshots require an explicit readiness wait.
Shared waits do not demand `aria-modal`, which the Report chat Sheet does not
expose. Section-editor `waitModal` retains its existing modal precondition
locally before using the general wait. The shared strict `assertFocused` lives
in the leaf `e2e/lead-form/focus.ts` to keep `helpers.ts` within the 300-line
limit without exemptions; it observes focus and the connected visible opener
without changing focus during restoration checks.
Auth and report-entry helpers are owned by `e2e/lead-form/access.ts`. They
verify the native dev-login role/email, then reuse the same 25-second
`waitSnapshot`/`waitScope` bounds to observe the authorized `getUrl` pathname,
My Report heading and selected report surface. The assistant answer waits for
its actual named heading. Shared `waitNotification(text, session)` observes
exact StaticText inside the `Notifications alt+T` region through the existing
25-second `waitSnapshot`. Pending Fill and reopen use it; three pending Slides
saves observe the success toast before retaining their modal-close checks.
After connectivity returns, navigation waits for `+ Add Risk`, and conflict
recovery waits for the exact recovery-region text plus its exact error toast.
All ten offline-return cases use bounded AX waits without sleeps or retries;
native text waits remain elsewhere. These changes retain every persistence,
request-count, dialog and deadline assertion
and avoid assuming the native text/URL wait recognizes those transitions.
Expandable
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
not establish that Chrome is unsupported. The N13 case passes both directions with URL/selected-option,
historical read-only and no-report-POST assertions.

A save failure may be reproduced only through a verified native CLI network
control, with retained input and a successful real-backend retry. Identify
fault injection; if no supported path is reproducible, record the precise
coverage limitation rather than add an alternate adapter. Assistant scenarios
use the browser CLI's network controls to stub the application's tRPC responses
for availability and assistant outcomes. These are response stubs at the UI's
tRPC boundary, not backend AI-provider stubs; they avoid remote or paid requests
and prove local UI behavior without claiming provider integration.
The citation finder uses the observed label
`S1E2E previous period · <product>`. Source navigation changes the report
context and closes the local chat Sheet as the loaded generation remounts.
Await that closed state and the read-only source context, then reopen chat and
assert the retained question/answer instead of expecting a Close control on an
already closed sheet.
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

- The shared target is exclusive to this suite; use no lane database or
  Redis DB 0, and restore the canonical full seed with the guarded
  `pnpm db:reset:hard full` before returning the target.
- CLI semantics differ from SDK locators -> inspect actual help/core skill and
  implement only real commands; unsupported coverage remains explicit.
- Conditional controls require fixture states -> use the narrow guarded overlay
  and bind every covered condition to source and a Node test title.
- Preparation can still write after a hook abort -> contain reset and overlay
  in one owned process group and finish its cleanup before the next test;
  browser cleanup uses an independent cancellation context.
- Static gates cannot prove visible flows -> record the static gates' exit codes separately
  from the complete browser run's exit code and pass/fail counts. Report
  reproduced product defects without weakening tests.
- Provider/failure interception may be unavailable -> never compensate with
  remote paid calls or a second browser adapter.
- Default browser runtime limits platform coverage -> no claim for other browser
  engines, production build behavior or SAML sign-in.

## Migration Plan

The native Node suite and CLI wrapper replace the task's earlier test
runner/dependency/configuration; product and database source are unchanged.
Run selected files as needed, then the full `pnpm test:e2e` suite, retaining
failure evidence outside the repository and distinguishing scenario errors from
reproduced product defects. Re-run the static gates, restore the canonical full
seed with exit 0, and record the final source SHA and browser counts in the
external report. Do not push or archive without the owner.
