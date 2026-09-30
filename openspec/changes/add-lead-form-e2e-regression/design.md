# Design

## Context

See `proposal.md` and `specs/behavioral-ui-regression-gate/spec.md` for scope
and acceptance. Lead authoring lives under
`apps/web/src/features/report-pages/ui/lead/`; Overview and its support
sections reuse the canonical item, Risk and Decision editors, draft coordinator
and reviewer feedback. Imported toolbar and Slides controls are part of the
capability inventory.

The owner selected installed `agent-browser` CLI 0.38.1 with TypeScript
`node:test`. The owner currently uses `customreport_e2e` through ports
3000/3002. During implementation no browser, database, Redis, reset, seed or
server startup is permitted. Only CLI help and its core skill may be inspected;
the four static repository gates provide delivery evidence. Later browser
acceptance requires the coordinator's exclusive runtime handoff.

## Goals / Non-Goals

**Goals:** Named source coverage, independently prepared browser scenarios and
one separate native Node acceptance command using the selected browser CLI.

**Non-Goals:** Product/API/schema changes, another browser adapter, a custom
test framework, server orchestration, new database lanes, CI acceptance,
remote provider execution or external publication. A Head browser session joins
the same test's Request changes, approval/rejection of Lead Request reopen, or
period publication/reopen needed to establish the Lead's published-lineage
controls in S13. This does not add a general Head regression suite.
Use native subagents for delegated work; do not use Devin for this task.

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
`e2e/setup/global-setup.ts`, `beforeEach` prepares that test's baseline, and
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

Only at future runtime setup, create the named session with the CLI command:

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
There is no browser launch or session creation during current static checks.

### Inventory and source boundaries remain explicit

`COVERAGE.md` records capability IDs, current source paths, conditions and
exact final Node test titles. Inventory imported child controls as well as the
Lead folder: every Overview action, section editor, priority/status,
completion, limits, feedback, navigation and viewing control. An implemented
scenario is not a runtime PASS.

The public form has Report/Overview and Slides; `mode=edit` normalizes rather
than opening a third route. Week-item Delete exists in the Slides canonical
editor, while its Overview counterpart has no Delete callback. Priorities
are Item projections. Product/Activity catalogue CRUD is not a Lead action.
The record-count limit dialog is absent: test existing `SAFE_TEXT` field
boundaries and validation, and record the unavailable dialog/server-only list
bound. A Product with no author stage assignment is filtered out by the
backend; the zero-owned-stage defensive panel is N/A for valid public data.
Never synthesize a selectable zero-stage Product to manufacture coverage.

Previous's historical occurrence is immutable and has no edit, move, confirm
or status control. For lineage without a matching Current occurrence,
`Plan this work` may create active work in the selected editable section
without changing Previous or its authoritative snapshot.

### Reuse guarded reset and independent baseline preparation

Each file's `before(globalSetup)` hook and each test's `beforeEach` share the
guarded demo reset/seed/overlay path. Require explicit matching `E2E_DATABASE_URL`/`DATABASE_URL`
targets, exact loopback `customreport_e2e`, non-production environment,
`REDIS_DB=15` and
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'`.
Refuse lane targets even though the guard accepts them for other tasks, and
log only a credential-masked target.

Preparation validates through `prisma/guards/_destructive-guard.ts` and runs
the entire reset+overlay flow in one owned child process group, with
`E2E_DATABASE_URL` mapped to that child's `DATABASE_URL`.
`e2e/setup/reset.ts` owns
`prepareE2eData(profile: "demo" | "minimal", signal: AbortSignal, scenario?: "archived-fill-only")`
and launches
`e2e/setup/prepare.ts`; native global/beforeEach hook contexts pass their
`context.signal`. This child runs `prisma/operations/reset-hard.ts` with the
selected profile and `tsx` loader, using ordinary non-detached descendants
that inherit the owned group, then runs the demo overlay in that same group.
The parent awaits child close before proceeding and performs no Prisma overlay
writes. This reuses the underlying `db:reset:hard` workflow: apply migrations,
truncate application data, sequentially SELECT/FLUSH Redis15, and explicitly
seed demo. Global and per-test preparation then apply the same narrowly
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

Native `summary` nodes expose the CLI's actual `DisclosureTriangle` accessibility
role; do not apply a browser SDK's button alias. Structural scope nodes may lack
snapshot references. Scope by the observed tree hierarchy and use only real
actionable references instead of inventing container refs.

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
100-pixel swipe. URL/selected-option changes, historical read-only state and
absence of report POSTs establish the result.

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

The future acceptance flow is:

```text
coordinator handoff -> validate exact target + consent + Redis15
  -> native node:test command, files run serially
     -> each file: before(globalSetup), owned demo preparation + session base
     -> each test: beforeEach, prior owned browsers closed -> fresh IDs -> demo preparation
        -> minimal conditions/S13: guarded minimal reset/seed, no overlay
        -> F01 archived condition: minimal + explicit archived-fill-only source
        -> real CLI/UI interaction -> snapshot/refetch assertion
        -> afterEach: close own sessions through independent cleanup context
     -> cancellation: stop/reap the owned reset+overlay process group
     -> SIGINT/SIGTERM: terminal abort -> await owned clients + cleanup -> 130/143
```

### Runtime prerequisites and preserved invariants

The coordinator supplies source web `http://localhost:3000` and API
`http://localhost:3002` with matching exact database targets,
`AUTH_DEV_MODE=true`, `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` and Redis15.
Only after handoff may the coordinator use
`REDIS_DB=15 pnpm exec turbo run dev --env-mode=loose`; `pnpm dev` may drop
that variable under strict Turbo filtering. Readiness does not establish the
app clients' selected Redis database.

No application middleware or write path changes. Fixtures retain complete
period lifecycle tuples and stable lineage. Previous/snapshots stay immutable;
historical replanning writes only the selected editable target. An explicit
Next commitment uses the existing Current occurrence rather than duplicating
the section/lineage unique key. Guarded
reset/seed/overlay have no URL or consent bypass.

## Risks / Trade-offs

- Shared target is currently busy -> no runtime execution until the coordinator
  stops competing writers and verifies app clients use the same target/Redis15.
- CLI semantics differ from SDK locators -> inspect actual help/core skill and
  implement only real commands; unsupported coverage remains explicit.
- Conditional controls require fixture states -> use the narrow guarded overlay
  and bind every covered condition to source and a Node test title.
- Preparation can still write after a hook abort -> contain reset and overlay
  in one owned process group and finish its cleanup before the next test;
  browser cleanup uses an independent cancellation context.
- Static gates cannot prove visible flows -> report four exit codes separately
  and leave browser acceptance pending.
- Provider/failure interception may be unavailable -> never compensate with
  remote paid calls or a second browser adapter.
- Default browser runtime limits platform coverage -> no claim for other browser
  engines, production build behavior or SAML sign-in.

## Migration Plan

Replace the task's earlier test runner/dependency/configuration with the native
Node suite and CLI wrapper; keep product/database source unchanged. Validate
the revised OpenSpec before converting tests, then run only authorized static
checks. Existing unit/build results are additional evidence, not browser
acceptance. Commit task-owned changes with the required Conventional Commit
subject and Codex coauthor; do not push or archive the pending runtime change.
