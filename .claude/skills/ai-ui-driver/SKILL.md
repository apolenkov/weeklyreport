---
name: ai-ui-driver
description: >-
  Autonomously drive the CustomReport web app through a role's behavioral
  surface in a live browser (Playwright MCP), find within-route flow/logic bugs
  AND new-path crashes the Layer-1 catalog sweep cannot, adversarially verify
  each finding, and package the confirmed work into a ready-to-implement
  OpenSpec change. Use this whenever the user wants to "drive" / "behaviorally
  test" / "scenario-test" one or more roles (lead, head, admin, viewer) against
  their oracle catalogs, find flow/logic/render bugs through the real UI, hunt
  for unscripted edge-case crashes, or "run the driver and collect an openspec
  of fixes" — even if they don't name this skill. It is NOT the Playwright e2e
  suite and NOT the Layer-1 catalog-sweep (route-load + axe); reach for it when
  the intent is in-app behavioral exploration that ends in a tracked change.
---

# AI UI Driver

Drive a real browser through a role's surface, compare what you observe against
the role's **oracle catalog**, hunt for unscripted crashes beyond it,
adversarially verify every finding, and emit a **ready OpenSpec change** whose
tasks are the fixes. You do the expensive live discovery now; a later session
runs `openspec-apply-change` to implement the tasks mechanically.

**You apply no code fixes and edit no catalogs.** Everything you find — fixes,
deferred product calls, dismissed artifacts, newly discovered paths, protocol
improvements — is _proposed_ as OpenSpec content for a human to approve and a
later session to implement. The value of this skill is disciplined discovery,
not autonomous editing.

## Source of truth (read, do not duplicate)

This skill orchestrates artifacts that already live in the repo. Read them at
run time rather than copying their contents here — if they change, the skill
must not drift from them.

- `e2e/sweep/driver/README.md` — the Driver design (phases, env-feedback
  channels, liveness contract), server ports/env, and the loopback-proxy note.
- `e2e/sweep/driver/drive-prompt.md` — the verbatim parametric drive prompt with
  the per-role table (seeded email + landing route per role).
- `e2e/catalog/<role>.yaml` — the oracle catalogs. Each `intents[]` has
  `given`/`when`/`then`/`note`; `then`+`note` are the expected behavior.
- `scripts/verify.workflow.mjs` (bundled with this skill) — the adversarial
  verify Workflow. It travels with the skill so it is never lost to an archive.

## Inputs

- **Roles**: default to every role that has a catalog (`e2e/catalog/*.yaml`).
  Accept a subset from the user ("drive viewer", "head and admin").
- **Config**: take seeded emails, landing routes, ports, and env from
  `drive-prompt.md` / `README.md`. Never hardcode them here.

## The autonomous flow

Run this end-to-end without stopping for approval, EXCEPT at the two hard gates
below (environment cannot be recovered; a finding needs a product decision).
Drive is sequential (one shared browser); verify fans out.

```
Phase 0    Environment        auto-recover → hard-stop if it can't be made healthy
Phase 1    Catalog drive      one sonnet sub-agent per role, sequential, canary
Phase 2    Free exploration   bounded novelty pass, loop-until-dry, crashes only
Phase 2.5  Env feedback       collect-env-feedback.mjs sweeps 4 channels, correl. to timeline
Phase 3    Verify             bundled Workflow, then Opus re-verify BOTH ways
Phase 4    Package            one OpenSpec change via openspec-propose
```

### Phase 0 — Environment (auto-recover, idempotent, hard-stop)

A blind drive against a half-up environment is worse than no drive — it reports
confident garbage. Bring the environment up in this exact order, checking each
gate before the next, and **hard-stop with a report if any step cannot recover**
(never drive a partially-up stack):

1. If web `:3100` and API `:3101` answer 200 **and** a dev-login returns 302,
   the env is healthy — skip to Phase 1.
2. Docker daemon down → `open -a Docker`, wait until `docker info` succeeds.
3. `docker compose up -d postgres redis mailhog`, wait for `:5432` and `:6379`.
4. Start the native sweep servers using the commands from
   `e2e/sweep/driver/README.md` (web on `:3100`, API on `:3101`, with
   `NEXT_PUBLIC_DISABLE_DEVTOOLS=true` + `NEXT_DIST_DIR=.next-sweep`). Wait for
   web 200 + API 200. **Do not depend on `.scratch/start-sweep-servers.sh`** — it
   is gitignored and absent in a fresh clone; use the README commands.
5. Verify a dev-login returns 302 for one role before driving. A 500 here means
   the API cannot reach its infra — fix the infra, do not proceed.

Use `--noproxy '*'` for curl checks; the Playwright-MCP Chromium ignores the env
proxy. Confirm the seed resolves a real `[reportId]` (e.g. the bare `/head/report`
redirects to a canonical id) so catalog routes resolve — an empty DB makes every
`then` look violated.

### Phase 1 — Catalog drive (sub-agent per role, sequential)

For each role, spawn ONE sub-agent (`model: sonnet` — mechanical browser-driving)
and have it run the `drive-prompt.md` protocol for that role. The browser is a
single shared instance, so roles run **one at a time**; first prove a sub-agent
can reach the shared browser with a one-call probe before the full drive.

Each drive MUST:

- Walk every catalog route in order; resolve `[reportId]` from the seed.
- Read console errors, snapshot shallowly, and observe whether each intent's
  `then` holds — interacting only where it is **safe and reversible**.
- Inject the console canary exactly once and confirm it is detected. **An empty
  candidate list is only trustworthy when `canary.detected=true`** — otherwise
  the capture path was blind and the "clean" result is meaningless.
- Write a durable per-role report to `e2e/sweep/.reports/<role>-driver.md`
  _before_ returning its JSON, so a long drive is never lost.
- Emit compact candidates (route, intentId, kind, observed, expected, evidence,
  severity) — never paste full snapshots.

An anomaly is real ONLY when an observation contradicts the documented `then`,
or there is a console error / pageerror / failed nav / infinite skeleton / layout
break. Behavior that matches `then` is not an anomaly — never report "works as
expected". Deferred-feature "COMING SOON" badges are expected, not bugs.

### Phase 2 — Free exploration (bounded, novelty-first, crashes only)

After the catalog drive for a role, do a SECOND pass that explores paths the
catalog does not enumerate — unscripted sequences and combinations of actions —
to surface crashes the oracle authors never imagined. This pass has no oracle,
so it judges by hard failures only.

- **Budget it.** Cap the pass (tool-uses / interactions); default modest. Scale
  up only when the user invokes with a token budget (`+500k`) or ultracode.
  Without a cap an agent wanders the known surface forever.
- **Novelty first.** Prefer state transitions and action combinations NOT
  covered by the catalog; do not re-walk documented intents.
- **Loop-until-dry.** Stop when N consecutive steps reach no new state (coverage
  saturated) or the budget is spent. A simple step counter misses the tail.
- **Read-only.** No irreversible actions (no publish, no permanent delete) —
  record such intents as `coverageNotes`, exactly as in the catalog drive.
- **A finding is only a crash / unhandled error / failed nav / broken render** —
  there is no `then` to contradict here. File these candidates with `kind:
"crash"` and no `intentId`; the verify phase judges them oracle-free.
- A valuable new path that is NOT a bug is still worth capturing — it becomes a
  _proposed new catalog intent_ in Phase 4 (oracle self-improvement), never a
  silent edit to the catalog.

### Phase 2.5 — Environment feedback (post-drive, pre-verify)

After the free-exploration pass for each role, run the bundled collector before
the verify fan-out. Full channel list, liveness contract, and canary-rule are
documented in `e2e/sweep/driver/README.md` Phase 2.5 (the canonical home —
do not duplicate here):

```
node .claude/skills/ai-ui-driver/scripts/collect-env-feedback.mjs \
  '{"role":"<role>","timeline":<timeline-from-drive-json>}'
```

The collector appends an "Environment feedback" section to the per-role report
(`e2e/sweep/.reports/<role>-driver.md`) and returns hits as Phase-3 candidates
with `kind: "env"` and no `intentId`.

### Phase 3 — Verify (Workflow first, then Opus re-verify BOTH ways)

Raw driver output is a false-positive factory. Run the bundled verify Workflow
once per role over that role's candidates:

```
Workflow({ scriptPath: ".claude/skills/ai-ui-driver/scripts/verify.workflow.mjs",
           args: { role: "<role>", catalog: "e2e/catalog/<role>.yaml",
                   candidates: [ ...phase-1 and phase-2 candidates... ] } })
```

The Workflow returns a skeptic verdict per candidate. **The skeptic is fallible
in BOTH directions** — it false-dismisses real bugs and false-confirms non-bugs.
So you (the main Opus session) re-verify every verdict before it becomes a task:

- **Reproduce UI findings empirically** in the live browser — click the control,
  watch the network — before treating it as real OR dismissing it. Code-reading
  alone misses which element actually renders and what it calls.
- **Check shared-component blast-radius.** A "fix" that touches a shared
  mapper/component can break another role. Confirm the proposed change does not
  regress a role you are not looking at.
- **Never edit the oracle catalog to make a finding match the code.** A genuine
  code/catalog divergence is a product question — defer it, do not silence the
  one signal that flagged it.

Only findings that survive your re-verification become fix tasks.

### Phase 4 — Package into one OpenSpec change

Use the repo's OpenSpec machinery (the `openspec-propose` flow) so the change is
valid (`openspec validate --strict` green). Produce ONE change per run.

Its `tasks.md` captures, per finding:

- **Confirmed bug** → a fix task: the file(s), the fix direction, and a required
  test. Enough that a later session implements it mechanically.
- **Deferred (product call)** → a task flagged "needs decision", stating the
  divergence and the options — never pre-decided by editing the catalog.
- **Dismissed** → recorded in a "not a bug + reason" section so the next run does
  not re-flag the same seed/test artifact.
- **New valuable path** (from Phase 2) → a proposed new catalog intent.
- **Protocol / skill improvement** noticed during the run → a task. The skill
  proposes its own improvements through OpenSpec; it does not self-edit.

Attach the per-role summary (routes driven, canary detected, candidates →
confirmed) and point to the `e2e/sweep/.reports/<role>-driver.md` reports.

## Guardrails (why they exist)

These are the discipline that separates this from a naive "drive and report
bugs" that floods you with false positives. Keep them.

- **Canary or it is blind.** Empty findings without `canary.detected=true` are
  meaningless — the capture path was dead, not the app clean.
- **Channel-canary rule (Phase 2.5).** A blind channel is never clean. An env
  channel that could not be reached must be reported as `blind`, not silently
  omitted. Empty-from-blind ≠ no errors.
- **Verify, then re-verify both ways.** The skeptic errs in both directions.
  Reproduce in the browser; check shared-component blast-radius. (See memory
  `driver-verify-skeptic-fallible`.)
- **Never mutate the oracle to fit the code.** Divergence = product call → defer.
- **Read-mostly drive.** No irreversible actions in either pass; record them as
  `coverageNotes`.
- **Drive sequential, verify parallel.** One shared browser → roles run in order;
  only verification fans out (a Workflow). Do not parallelize the drive.
- **Propose, never apply.** No code edits, no catalog edits, no self-edits — the
  output is a tracked OpenSpec change.
- **No package installs.** `pnpm add` can wipe `node_modules` here (memory
  `npm-offline-install-hazard`); the drive needs none.
- **Stage discipline if you ever touch git.** Never `git add -A` — untracked
  tooling files (`.agents/`, `.codex/`, `opencode.json`, `skills-lock.json`) are
  not yours. The skill normally writes only reports + the OpenSpec change.

## Done when

`openspec validate <change> --strict` is green and the change lists every
confirmed fix as a task, every deferral as a flagged task, every dismissal with a
reason, and any new paths as proposed intents. Hand the change name to the user;
the next session runs `openspec-apply-change` on it.
