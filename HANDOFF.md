# Handoff — behavioral-ui-regression-gate — 2026-06-04 (after context reset)

Branch: `docs/behavioral-ui-regression-gate`. Resume here after `/clear`.

## Bottom line

The catalog generator is **hardened and validated on `lead`**. `lead.yaml` is a
finished, clean catalog. `viewer.yaml` is a coherent partial. Remaining roles
were **deliberately not generated** — the user is at ~95% of weekly token budget,
so all expensive Workflow/fan-out runs are paused. Next steps are cheap-only.

## ⚠️ Cost constraint (binding)

User has ~5% of weekly tokens left. **Do NOT launch Workflow / fan-out /
deep-research without an explicit per-run "yes".** Each catalog run is ~0.75–1M
tokens. Three parallel runs (viewer/head/admin) were launched then **stopped
mid-flight** to protect budget. Default to cheap, direct edits only.

## State of the work (all durable, already paid for)

- `e2e/catalog/lead.yaml` — DONE: 10 routes (= README denominator), 44 intents,
  ids globally unique. Generator-reproduced; hardening (census + id-uniqueness)
  proven end-to-end. Backup of the earlier hand-reviewed version:
  `/tmp/lead-reviewed-2026-06-04.yaml` (may be gone after OS temp cleanup).
- `e2e/catalog/viewer.yaml` — PARTIAL bonus (persisted before critic/repair):
  6 routes, 14 intents, ids unique. One cosmetic defect: the `/` route is
  mislabeled `viewer-landing` — one-line fix, not yet done.
- `e2e/catalog/_lead-coverage.md` — coverage matrix for lead.
- Generator `openspec/changes/behavioral-ui-regression-gate/workflow/generate-catalog.workflow.mjs`
  — hardened this session: (1) mechanical `find page.tsx` **census denominator**
  Discover must fully account for (asserted in-script before extract);
  (2) deterministic **id-uniqueness** assert gating the repair loop; (3) **args
  parsing fix** — `args` arrived as a JSON string so `args.role` was ignored and
  every run defaulted to `lead` (that is why the "viewer" canary regenerated
  lead). Now parsed defensively. Syntax + prettier clean. eslint ignores
  `openspec/**`; prettier ignores `e2e/**`, so catalogs/script are gate-safe.
- `design.md` (+2 decisions: mechanical denominator, deterministic id-assert) and
  `tasks.md` (1.3/1.4 done; new 1.4b = generator hardening) updated.
- head/admin NOT generated (no head.yaml/admin.yaml written).

## Why hardening (the 3 defects the first lead run hid)

Full record in `e2e/catalog/_lead-coverage.md`. Short version: the critic keys
completeness off Discover's own route list, so a silent route drop is invisible;
and the critic schema never checked id-uniqueness. Both are now deterministic
script-level guards, not LLM judgment.

## Next steps (CHEAP only — get a per-run "yes" before anything expensive)

1. **Finalize + archive plan (cheap, md edits only).** Per `openspec/config.yaml`
   `change_lifecycle`: archive happens _after merge to main_. The change cannot
   honestly archive now — tasks 2–5 (dev-auth restore, Driver, remove old e2e
   harness) are undelivered. Recommended: **split** — this change closes task 1
   (catalog + hardened generator) → finish/merge/archive; Driver + harness
   (tasks 2–5) → a **new change** (the one to start "tomorrow"). Satisfies both
   "finish subtasks later" and "start a new change tomorrow".
2. **For a boss demo:** `lead.yaml` (full) + `viewer.yaml` + ADR
   `docs/adr/0001-live-exploratory-ui-sweep.md` + design — concept proven on two
   roles; head/admin runs are not needed for the demo.
3. **If/when budget allows** (explicit yes, ~0.75–1M each): regenerate
   head/admin. Both reach `/lead/*` like lead, so expect the bare/canonical
   `/lead/report` id-collision — the generator detects but won't auto-collapse
   without a prior catalog; hand-collapse the bare route to its 2 back-compat
   intents (see lead.yaml `/lead/report`).

## Gotchas (still apply)

- rtk hook breaks `grep`/`rg`/`pnpm exec` — use `/usr/bin/grep`, `./node_modules/.bin/*`.
- Workflow scripts have no filesystem — a persist-agent writes files; the script
  composes exact bytes. `node --check` reports "illegal return" (expected — the
  runtime wraps the body in an async fn).
- Pass Workflow `args` as a real JSON object; it may still arrive stringified —
  the script now tolerates both.
- Do NOT create/update PRs unless told; the user asked only to commit+push the
  branch this session.

## Suggested skills (next session)

- `opsx:verify` — check task-1 completion vs spec before any archive.
- `opsx:archive` / `openspec-archive-change` — only after merge to main.
- `opsx:new` / `opsx:propose` — to open the Driver/harness follow-up change.
- `code-review` — before merging this branch.
