# Execution plan — exemplary program (master handoff, 2026-07-02)

One-shot is impossible (session token limits + the parallel session owning 186
files + code fixes commit to a shared tree). Model = **handoff-and-grind**:
each session smashes one wave via an UltraCode workflow, then hands off here.
Model tiers (owner-set): find/scan → sonnet, implement/synthesize → opus,
**review/verify → fable**.

## Where we are

- **Standard + policy**: `tighten-comment-policy` APPROVED (4-round Fable/Opus
  review) + implemented in `docs/exemplary-code-standard.md` §1.3 and
  `.claude/workflows/exemplary-rollout.js`. Owner confirmed the 3-line budget.
- **Audit 59% done**: 263/449 src files → 49 per-file reports in
  `docs/audit/` (+`wave1/`), 603 verified findings. Index:
  `docs/audit/INDEX-2026-07-02.md`.
- **Roadmap**: `docs/audit/FIX-ROADMAP-2026-07-02.md` — 80 work-items,
  prioritized, each mapped to an existing backlog change / a `new:` change /
  a `sweep:` folder.
- **Codex**: quota-dead all session (4 attempts). Cross-model review = manual
  re-run only.

## Addendum (same day, later): catalog + architecture + 8 new changes

- **File catalog**: 491/492 src files described (purpose/layer/domain/exports)
  → `docs/architecture/catalog/` (56 tables + index).
- **Target architecture APPROVED** (3 Fable rounds): api = modular DDD with
  tiered module depth + hexagonal ports; web = feature-sliced (rule-of-2 for
  shared graduation); enforcement via import-x/no-restricted-paths ratchet.
  Docs: `docs/architecture/TARGET-STRUCTURE-2026-07-02.md` + per-file mapping
  (255 moves) in `docs/architecture/mapping/`. Change:
  `restructure-directory-architecture` (strict-valid, Fable-APPROVED).
- **7 roadmap changes authored + Fable-reviewed + strict-valid**:
  unify-web-status-color-tokens, unify-status-presentation,
  shared-coming-soon-control, centralize-redis-connection-config,
  centralize-web-api-url, complete-env-schema-coverage,
  require-period-scheduler-deps.
- Primary-source research on monorepo organization running in background →
  `docs/architecture/research-monorepo-organization-2026-07-02.md`; if it
  contradicts TARGET-STRUCTURE, reconcile BEFORE executing slice 1.

## Executed (2026-07-05)

- **centralize-web-api-url** — DONE, pushed d0aecff0 (Fable APPROVED).
- **centralize-redis-connection-config** — DONE, pushed 6273bd22 (Opus impl,
  Fable APPROVED; two plan gaps found+fixed: DI-external
  SessionRevocationService constructions in main.ts + trpc.context).
- Wave-3 audit reports landed (background agent) → docs/audit/wave3/.
- Parallel session ACTIVE in web components (lead/slides WIP, their tests red)
  — web-touching changes (unify-web-status-color-tokens,
  unify-status-presentation, shared-coming-soon-control) WAinternal tooling.
- Next: complete-env-schema-coverage (api, clean folders), then
  require-period-scheduler-deps (check period folder cleanliness first).

## Live state (2026-07-05 ~01:40, mid-execution — superseded by "Executed" above)

- **centralize-web-api-url IMPLEMENTED, UNCOMMITTED**: new
  `apps/web/src/lib/server/api-url.ts` (+tests, 27 green), rewired
  next.config.ts / client-logs route / 3 server helpers, placeholder deleted,
  env docs updated. Gates: typecheck+lint+web 1523/1523+build ALL GREEN.
  Codex diff review launched (codex:codex-rescue). On clean review: tick
  tasks.md, validate --strict, commit ONLY these paths (no `git add -A`),
  push main (pre-push runs the full gate).
- Notable: tighten-comment-policy + tighten-code-quality-ratchet already
  IMPLEMENTED+ARCHIVED by the other session; Redis fallbacks already killed
  (ee4c11b2) — slim centralize-redis-connection-config to the dedup remainder
  before implementing.
- In-session cron 3416cb85 resumes at 03:46 if the limit pauses us.

## Remaining work, in order

### 1. Wave 3 audit — 186 files (BLOCKED on the parallel session)

Folders still dirty: api auth/admin/period/carry-over/report-sections +
infrastructure/trpc; web components admin/lead/weekly-report + lib/mappers;
packages/shared/src; + api main.ts/app.module.ts. Gate: `git status` clean per
folder. Run the same lean pipeline (sonnet find → fable verify → local-script
report, NO synth agents) → reports into `docs/audit/wave3/`. Then extend the
roadmap.

### 2. Execute the roadmap — three tracks (each item names its track)

- **Cross-cutting wins first** (roadmap §"Cross-cutting wins"): each collapses
  many files behind ONE shared artifact. The api-infra ones live in CLEAN
  folders and are implementable NOW (#16 Redis config, #17 createServiceLogger,
  #27 read-through cache, #14 QueueRegistry, #45 time constants where consumers
  are clean). The web ones (#4 CardSurface, #8 RotatingChevron, #3 status
  presentation, #51 ComingSoonControl) touch dirty folders — wait for wave 3.
- **Routes to existing backlog**: fold the style fix INTO that change's
  implementation, never a second diff (roadmap §"Routes to existing backlog").
- **New changes (7)**: unify-status-presentation, unify-web-status-color-tokens,
  shared-coming-soon-control, centralize-redis-connection-config,
  centralize-web-api-url, complete-env-schema-coverage,
  require-period-scheduler-deps. Author as OpenSpec changes before implementing.

### 3. Follow-up sweep — `sweep-auth-comments-exemplar`

The auth comment sweep (calibration table in `tighten-comment-policy/design.md`).
Gate: owner veto pass + clean auth folder + `fix-open-redirect-next-param`
archived (D6/D7 ordering).

## Per-session recipe (how to grind one wave)

1. `git status` — pick a target with NO dirty overlap and no active change
   owning it (else fold into that change).
2. UltraCode workflow, worktree-isolated per folder, full gate
   (`db:generate && typecheck && lint && test`) + a **fable** adversarial
   review of each diff BEFORE keeping it (revert-bait guard).
3. Read every diff yourself; commit only your own paths (shared tree — never
   `git add -A`); never push red.
4. Update this doc + the roadmap; hand off.

## Hard constraints (do not violate)

- Read-only audits are always safe; code sweeps are folder-scoped and gated.
- Correctness backlog waves (A–D of the 2026-06-28 review) outrank style on the
  same folder.
- No behavior change in a "style" sweep — prove it with the gate + review.
- Owner is a code-style perfectionist ("каждая запятая"); constants = STRICT.
