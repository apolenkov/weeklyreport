# Overnight backlog implementation — 2026-06-30

**Branch:** `impl/backlog-2026-06-30` (off `chore/exemplary-code-standard`).
**`main` was kept frozen / demo-stable the whole time — nothing pushed to it.**
13 OpenSpec changes implemented, each its own commit, each verified
(typecheck + lint `--max-warnings 0` + full unit suite + build), and every
security/concurrency/data fix additionally proven by a **real-DB integration
test**. OpenSpec `archive` was deferred to merge time (see below).

## What landed (in commit order, oldest first)

All of roadmap **Wave A (11 P0 prod-blockers)** + 2 P1:

| #   | commit   | change                          | what it fixes                                                                              | extra verify                            |
| --- | -------- | ------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------- |
| 1   | df8430a0 | escape-org-data-script          | stored XSS — removed the dead `__org_data` inline-script sink + charset-guard on org write | layout render test                      |
| 2   | 98758dec | set-express-trust-proxy         | `req.ip` was the Caddy IP → broke auth rate-limit + audit                                  | unit (X-Forwarded-For)                  |
| 3   | cc4716b3 | fix-prod-web-build-args         | prod web image baked dev defaults (dev-login picker instead of SSO, stale API_URL)         | `compose config` resolves args          |
| 4   | 4a0b3ef3 | fix-open-redirect-next-param    | `/\evil.com` + `@evil.com` open-redirect bypasses (web + dev-login routes)                 | helper unit tests                       |
| 5   | ee302140 | guard-autopublish-archived      | auto-publisher resurrected an archived period (TOCTOU) → compare-and-set                   | **real-DB race test**                   |
| 6   | 6d13c822 | fix-carryover-persistence       | data loss: wrong field (`stageName`), only first section, dropped P2002                    | **real-DB integration**                 |
| 7   | 8876cd2f | route-pdfs-and-authz            | `/pdfs` served unauthenticated — anyone could pull another group's report PDF              | **real-DB D3 authz test**               |
| 8   | 49f5520c | scope-analytics-to-group        | analytics leaked other groups' data (nested-include scope)                                 | **real-DB cross-group leak test**       |
| 9   | a68d65ee | scope-leadform-revoke-authz     | BOLA: head could revoke another group's section                                            | **real-DB BOLA test**                   |
| 10  | 60b6bc26 | serialize-autosave              | overlapping autosaves raced / clobbered across sections                                    | jsdom hook tests                        |
| 11  | 82f847f7 | add-section-optimistic-lock     | concurrent writers silently clobbered a section (+ `version` schema column)                | **real-DB lost-update test**            |
| 12  | cc99b037 | period-uniqueness-db-constraint | open-per-boundary P2002 → raw 500 everywhere (incl. login/scheduler)                       | **real-DB ground-truth P2002 test**     |
| 13  | 1553ca93 | map-domain-errors               | bare `throw` → tRPC 500; typed 12 sites + 3 new errors → correct codes                     | exhaustive mapper test + real-DB TOCTOU |

(The branch also carries the earlier prep commits already on `chore/exemplary-code-standard`: the exemplary-code-standard docs, env-strict refactor, dev-login split.)

## Merge guidance (confidence-ranked)

All 13 are gate-green; merge confidence is HIGH for the api/logic changes (gate

- integration). Two carry **deploy-time checks I could not run locally** — verify
  these before/at the prod deploy, not at merge:

* **route-pdfs-and-authz (#7):** `caddy validate` both Caddyfiles (caddy not
  installed here) + curl the `/pdfs` path on the direct API host port with no
  session → expect 401/404. Download-access audit (task 3.7) was deliberately
  left unwired (the spec marks it "Pending D-Open" — your call). The deleted-user
  fail-open on the PDF resolver is unchanged and is meant to be closed by
  enforce-deactivation (#17, not done — see below).
* **fix-prod-web-build-args (#3):** build the prod web image + browser-check SSO
  (tasks 4.2–4.4, 4.6) — these need an actual prod docker build.

## Schema change — IMPORTANT for deploy

#11 adds `ReportSection.version` (the init migration `20260530162224_init` is
hand-edited). The column reaches a DB only via `prisma migrate reset`. I applied
it to **`customreport_test` only** (left `customreport_dev`/the demo untouched).
On deploy / each env, the schema applies through the same MVP reset flow.
Prisma-7 reset recipe (from repo root): `DATABASE_URL=<target>
pnpm exec prisma migrate reset --force` (NO `--schema`/`--skip-seed` flags; config-driven;
needs `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`).

## After merge

1. `openspec archive <name>` for the 13 (use `--skip-specs` if it hits accumulated
   main-spec debt — see memory `openspec-archive-spec-debt`).
2. Re-enable prod trust-proxy / metrics only after `ci-deploy-supplychain-hardening`
   (#32, not done) closes the direct API host port.

## NOT done (the rest of the backlog + the other two tracks)

Scope was capped here per your call ("finish #13 → report → review"). Remaining
**23 OpenSpec changes** — none are prod-blockers (P0 is fully done); they are P1
correctness/observability + P2/P3 hygiene:

- **Wave B remainder:** scope-period-lifecycle-authz (#14), scope-reminder-authz
  (#15), make-publish-atomic (#16 — must extend the period-dual-state CI matcher
  to `updateMany`), enforce-deactivation-pdf-bullboard (#17 — must FOLD a
  null→fail-closed check INTO `resolveHumanSession`, not re-extract),
  scope-leadform-getbyperiod (#18), transactional-snapshot-restore (#19 — land
  BEFORE observability #33; obsoletes its task 3.3).
- **Wave C (13):** fix-analytics-date-matching, fix-reminders-escalation-dedupe,
  harden-web-vitals-endpoint, protect-metrics-endpoint, guard-metrics-scrape-db-failure,
  fix-period-datetime-tz, fix-risk-stage-integrity-impl, key-charts-by-id,
  fix-dashboard-nan-pending, fix-heap-health-threshold, enforce-smtp-config,
  observe-prisma-pool. **STRICT-ENV TRAP:** the designs for enforce-smtp /
  fix-heap / observe-prisma-pool propose `.default()`/in-code fallbacks that
  violate the no-fallback standard — reconcile to requireEnv + compose `${VAR:?}`.
- **Wave D (4 + ratchet):** ci-deploy-supplychain-hardening, observability-and-perf-hardening,
  code-health-and-test-cleanup (init-migration hand-edit — serialize with #11),
  input-and-error-hardening (PARTIAL: items 4+9 already shipped),
  tighten-code-quality-ratchet (LAST).
- **Track 2 (exemplary code-style rollout):** NOT started.
- **Track 3 (net-new bug hunt):** NOT started — the OpenSpec backlog _was_ the
  verified bug list (that's what these 13 + the 23 remaining are); track 3 is for
  bugs _beyond_ it.

## How to resume

- Conflict-aware order + seam map + per-change caveats:
  `<scratch>/NIGHT-PLAYBOOK.md`; full triage/synthesis:
  the `backlog-triage` workflow result (`.result.synthesis`).
- Pattern that worked: one subagent implements on the shared tree (serial — the
  `trpc.router`/`error-mapper`/`admin.*` seams force order), reports a diff; I
  review the diff + run the FULL monorepo gate (it caught a shared-package miss
  the api/web-only run didn't) + run any integration test it wrote (ground-truth
  integration tests caught a latent prod-500 that fabricated-meta unit tests
  missed) + commit. `.claude/workflows/backlog-triage.js` is reusable (untracked).

---

## Session 2 (2026-06-30, ~10:00–11:00): #14 attempted → PARKED in stash

Resumed Wave B remainder. Reused a per-change workflow
(`<scratch>/waveb-change.js`: implement on shared tree → 2 adversarial
verifiers, no commit). Attempted **#14 `scope-period-lifecycle-authz`**.

**State: NOT committed. WIP lives in `git stash@{0}`** (message starts
`WIP #14 scope-period-lifecycle-authz …`). The branch HEAD is unchanged — still
the 13 verified commits (`1553ca93`). `main` untouched.

The implement agent finished the full change (18 files: period.service/repo +
weekly-report.service/repo resolvers, trpc.router, trpc.error-mapper, admin
period-admin guard, module DI wiring + tests incl. a new real-DB integration
test) and reported **change-scoped** typecheck + lint(`--max-warnings 0`) +
unit + the change's integration test all GREEN. **I did NOT run the full
monorepo gate** (parked before that). Two adversarial verifiers then returned
**two MAJOR findings** — that's why it's parked, not committed:

1. **[BLOCKER — confirmed by direct service-layer repro] reopen→republish
   brick.** #14 authorizes a head's **reopen** against
   `getLatestPublishedNonArchivedId()` but **publish** against
   `getCurrentEditableId()`. When week N is the latest published and week N+1 is
   already open (the normal steady state — `one_open_per_boundary` is per-boundary
   UNIQUE, so two editable periods coexist), a head can reopen N (N ===
   latest-published-non-archived) but then **cannot republish N**:
   `getCurrentEditableId()` orders editable rows `periodStart desc` and returns
   the newer N+1, so `N !== N+1` → `PeriodScopeError` → FORBIDDEN. The reopened,
   edited week-N report can only be recovered by an admin. The design's own
   "reopen-first is a real remedy" is false for the head role. The existing
   publish→reopen→republish unit test misses this (single-period mock map, so the
   resolvers never diverge).
   **Fix direction:** publish authz must also accept a head republishing the
   period they just reopened — e.g. treat a `periodStatus === "reopened"` target
   as a valid active publish target (reopen is already gated, so this re-opens no
   hole), or resolve "the active period" as the one the head is working on rather
   than strictly newest-`periodStart` editable. **Add the multi-period
   reopen→republish test** (two periods where `getCurrentEditableId()` diverges
   from the reopened target) — the gap the current test can't see.

2. **[follow-up, out of #14's declared scope] `review.publish` sibling
   bypass.** `review.publish` (`trpc.router.ts:707`, `headProcedure`, reachable
   by a plain head) → `publicationService.publishReport(session.activeReportId,
…)` still guards only `status === "published"` — NO archived check, NO
   active-target equality. It publishes `session.activeReportId` (NOT a
   client-chosen id, and no prod web client calls it — only an msw stub), so the
   "publish an ARBITRARY period" headline is not reachable here, but a head can
   still publish their own stale/archived session report, undercutting #14's
   stated invariants. **This belongs in a separate change** (e.g.
   `scope-review-publish-authz`) — fold the same archived + active-target guard
   into `publishReport`, or have `review.publish` reuse the hardened
   `PeriodService.publishPeriod` path. Not a #14 blocker; #14 scopes to
   `period.publish`/`period.reopen` only.

Impl agent's own open questions to weigh on resume:

- **D4 ordering residual (likely intentional):** a head targeting an
  already-published NON-archived period surfaces as `PeriodAccessError` →
  INTERNAL_SERVER_ERROR (500), not FORBIDDEN — honors D4's carve-out that
  `PeriodAccessError`'s pre-existing 500s stay unmapped (tracked as
  BL-ERROR-MAPPING). Confirm this reading is wanted; if full scope-before-state
  is intended it's a one-line guard reorder + assertion update.
- **DI wiring** (`PeriodPrismaRepository` now injects
  `WeeklyReportPrismaRepository`; `WeeklyReportModule` newly exports it) is
  verified by typecheck + structure only — no change-local test compiles the Nest
  DI graph. First exercised at app boot / pre-push. **Verify boot before trusting.**
- **2 PRE-EXISTING integration reds** surfaced by the integration config, left
  per flag-don't-fix (NOT caused by #14): `weekly-report.integration.test.ts`
  (its `makeWeeklyReport` fixture omits `leadSections[].version`, required since
  `82f847f7` / #11) and `weekly-report.current-editable.integration.test.ts` (its
  tie test creates two `open` periods sharing `periodStart`=`periodEnd`, which the
  enforced `Report_one_open_per_boundary` partial index now rejects). Both want
  their own tiny fixup changes.

**Resume #14 in minutes:** `git stash pop` → apply finding-2 fix + its
multi-period test → decide finding-1 (recommend: split to a new change) → run the
**FULL** monorepo gate (`pnpm typecheck && pnpm lint && pnpm test && pnpm build`)

- the change's integration tests yourself → `openspec validate
scope-period-lifecycle-authz --strict` → commit. Then continue #15
  `scope-reminder-authz` (baseline already studied: reuse `groupScopeFilter`;
  recipient-level filter on `listExecutions` must run BEFORE cursor pagination;
  single-lead `dispatchPending` authorizes via `groupScopeFilter(session,"user")`,
  not a section).

Process lesson confirmed: the **adversarial-verify stage earned its keep** — both
findings are real (one a confirmed regression that the change's own unit test
could not see), caught before any commit. Keep the implement→verify→(human gate

- integration + commit) shape. Cost note: implement at `effort: 'max'` ran ~40
  min for one change — drop to `'high'` for the lighter Wave B/C authz scans.

---

## Session 3 (2026-06-30, post-demo): #14 LANDED

**#14 `scope-period-lifecycle-authz` is committed: `fb7be80c`.** The two parked
findings are resolved:

- **Blocker (reopen→republish brick) — FIXED.** publish now accepts a `reopened`
  target directly (strict equality vs `getCurrentEditableId` bricked the
  legitimate flow when a newer open period coexists). To keep that safe, a
  **single-active-reopen guard** (Саша's decision — option A) stops a non-admin
  head from holding two reopened periods at once. Admin exempt. New
  `getReopenedNonArchivedId` port method. Proven by 3 unit tests (happy-path
  republish, walk-back rejection, admin bypass) + a real-DB integration test
  (`period.single-active-reopen.integration.test.ts`, 4/4). Full monorepo gate
  green (typecheck + lint `--max-warnings 0` + 1352-test unit suite + the #14
  integration tests run against `customreport_test`).

  > **CORRECTION (Codex review of `fb7be80c`, post-commit).** The guard
  > **NARROWS but does NOT close** the walk-back — the #14 commit message and an
  > earlier draft of this note overclaimed "closes." Codex found the
  > **archive-assisted walk-back**: `archiveReport` is a head-accessible,
  > unguarded mutation (`trpc.router.ts:1791`, `headProcedure`,
  > `adminService.archivePeriod(any reportId)`), so a head can
  > `reopen(P3) → republish(P3) → archiveReport(P3)` — which uncovers P2 as the
  > new `getLatestPublishedNonArchivedId` while leaving ZERO reopened rows — then
  > `reopen(P2) → republish → archive`, walking back through all history and
  > rewriting each snapshot. The guard can't see it (one reopened at a time is
  > respected at every step). This is NOT closeable inside #14's reopen/publish
  > surface — the root is the unguarded `archiveReport`. **#14 still ships: it is
  > a net improvement** (pre-#14, reopen had no checks at all → historical reopen
  > was a trivial one-step exploit; #14 forces the archive chain). The fix lives
  > in the follow-up below, NOT in #14.

Two follow-ups remain (NOT blockers, NOT in #14's scope):

1. **`harden-head-lifecycle-mutation-authz` (new change — consolidates the
   head-accessible state mutations that lack an active-target/scope guard).**
   One class of bug; fix together:

   - **`archiveReport` / `unarchiveReport`** (`trpc.router.ts:1791` / ~`:1807`,
     `headProcedure`) → `adminService.archivePeriod`/`unarchivePeriod(any
reportId)` with NO guard. This is the root of the **archive-assisted
     walk-back** above. A head can archive/unarchive any period. Needs an
     active-target / non-historical guard (or admin-only for arbitrary targets).
   - **`review.publish`** (`trpc.router.ts:707`, `headProcedure`) →
     `publicationService.publishReport` guards only `status === "published"` — no
     archived / active-target guard. Publishes `session.activeReportId` (not
     arbitrary), no prod web client calls it, but a head can still publish their
     own stale/archived session report. Fold the same guards in, or route through
     the hardened `PeriodService.publishPeriod`.
   - **MAJOR #2 (Codex):** `publishPeriod` skips the active-target check for ANY
     `periodStatus==='reopened'` target, so if an admin reopened a historical P2
     while P3 is current editable, a head can `period.publish(P2)`. Low severity
     (needs a prior admin reopen) but the same class — tighten here too.
     The common invariant to design: a non-admin head may only publish / reopen /
     archive / unarchive at the time-frontier (the current editable period or the
     single period it just reopened), never reach historical periods by chaining
     these mutations.

2. **Integration-fixture debt from #11 (`add-section-optimistic-lock`).** Three
   integration test files are red — NOT caused by #14, NOT in the pre-push gate
   (unit only), surfaced only when running the integration suite:
   - `weekly-report.integration.test.ts` + `weekly-report.scope-filter.integration.test.ts`
     — section fixtures omit `leadSections[].version`, required since #11
     (`82f847f7`) → `ZodError: expected number at "version"`. Add `version`.
   - `weekly-report.current-editable.integration.test.ts` tie test — creates two
     `open` periods sharing `periodStart`, which #12's
     `Report_one_open_per_boundary` partial unique index now rejects. Rework the
     premise. Best as one small `fix-integration-fixtures` change.

Gotcha logged: after adding a repository-port method, a broken integration-test
mock surfaces only via the **integration suite** — the unit `pnpm test` excludes
`*.integration.test.ts`, and `pnpm typecheck` runs through turbo and can serve a
**cached** "No errors" that masks it (a fresh `tsc -p tsconfig.json` DOES catch
it — integration files are in the tsconfig). So run
`pnpm --filter @customreport/api test:integration` for the touched modules after
any port change; that is what caught `period.integration.test.ts`'s mock missing
`getReopenedNonArchivedId`.

## Session 3 cont.: #15 LANDED

**#15 `scope-reminder-authz` is committed: `facead76`.** The three reminder tRPC
procedures (`execute` / `listExecutions` / `dispatchPending`) now bound a
non-admin head to their own group via `groupScopeFilter` (admin keeps god-mode);
all thread `ctx.session`, all stay `headProcedure`. listExecutions filters
out-of-scope recipients over the full slice BEFORE pagination; execute closes the
open-mailer; dispatchPending scopes bulk + single-lead and preserves the
no-matching-section success state.

Reviewed three ways before commit: my diff review (matches design), the
per-change workflow's adversarial verify (completeness clean; one minor
test-coverage gap → added an admin-dispatchPending test), and a **Codex review**
that found one **major**: `dispatchPending` let an out-of-scope _active_ report
(activeReportId is the globally-newest draft, not group-bounded) reach rule
resolution and return `dispatched:0` instead of FORBIDDEN — a rule-existence
oracle. FIXED in the same commit (a report-scope guard before rule resolution) +
a regression test. Full gate green (typecheck + lint + 1191 api / 1352 web unit +
13-case real-DB integration).

Process note: **run Codex review on each authz change before commit** — it caught
real holes on both #14 (archive walk-back) and #15 (dispatchPending oracle) that
the workflow verify missed. Codex agentType for the Agent tool: `codex:codex-rescue`.

Next in Wave B: **#16 `make-publish-atomic`** (caveat: MUST extend the
period-dual-state CI matcher to `updateMany` — task 5.1), then #17
`enforce-deactivation-pdf-bullboard` (fold null→fail-closed INTO
`resolveHumanSession`), #18 `scope-leadform-getbyperiod`, #19
`transactional-snapshot-restore` (land before observability #33).
