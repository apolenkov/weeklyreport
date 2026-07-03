# In-flight — activity-first-class epic + full backlog closeout (2026-07-03)

Autonomous session (Саша at a conference, phone-only). Goal: close ALL OpenSpec
debts + tails, archive, on main. Ultracode + workflows + council/Codex review.

## Done + committed this session (on `impl/backlog-2026-06-30`, == main, FF)

- `ca0625c` refactor(auth) — options-object createSessionCookie (adopted a dead
  session's clean uncommitted refactor; auth tests green).
- `b9aa328` + `5a33adb` — tighten-comment-policy implemented + ARCHIVED (standard
  §1.3 three-line WHY budget, rollout recon dimension; task 3.3 verified).
- `88af723` docs(audit) — landed the 2026-07-02 603-finding audit + fix-roadmap as
  durable reference (owner taste-verdict pending; NOT a green light to fix every row).
- `090c4c8` — Q1/Q2/Q7 LOCKED by a full 3/3 owner-delegated council (see
  docs/feedback/council-decisions-2026-07-02.md "RESOLVED 2026-07-03").

## Council resolution (owner-delegated, code-verified)

- Q1: activity presence = ONE severity-free COUNT column in LeadSummaryTable
  (`activityCount` in dashboard.ts mapper). Product count columns MUST exclude
  null-projectId records (they read raw section arrays → would inflate). No lane,
  no derived activity-status on dashboard (severity → Phase 2).
- Q2: record-status Option A derive-only, PHASED, pure overlay; enum-value removal
  deferred. (Sweep 4.)
- Q7: KEEP shipped within-group priority float (no change). (Sweep 5 simplified.)

## Epic state (activity-first-class) — IN FLIGHT, NOT yet committed

- Phase A DONE + DB-verified: schema.prisma + hand-edited init migration reshaped;
  `migrate reset` applied to customreport_dev; drift-check "No difference detected";
  psql confirms 3 XOR CHECKs + activity FKs (RESTRICT) + join CASCADE + dropped
  ProjectActivity.projectId + nullable parent FKs. Client regenerated.
- Phase B DONE + green: shared contracts (section.schema/project-activity.schema/
  section-validation/report-primitives). XOR+conditional-stage on write schemas,
  submit relaxation, sectionActivity.linkedProducts+derivedStatus, admin
  linkedProductIds, validateRecordActivityIds. shared typecheck+build green, 348
  tests (12 new). **NOT committed** (api/web still red until backend+UI land).
- Phase C (backend 3.1-3.9) IN PROGRESS via a deep-reasoner subagent.
- Remaining epic: UI (lead dialog parent-picker 4.x, lead form/slides 5.x, head
  report 6.x + Q1 dashboard count), seed 7.1, web tests 8.3, specs 9.1, verify 10.x.

## The dev stack

Stopped the 20h-stale parallel session's `pnpm dev` (next + api from source) so
`migrate reset` could drop cleanly. Docker postgres+redis stay up. Restart from
source for live-verify (docker image is stale). DB is RESET + EMPTY (no seed yet).

## Queued closes (not the epic)

- observability-and-perf-hardening: implemented in 0e62e92d (42 commits back),
  15/16 tasks w/ tests, board 0/18 stale. Before archive: reconcile tasks.md 3.2
  (keyset cursor) + 3.3 (superseded by 4455edb1) + run gate. NO code. Do at first
  post-epic green checkpoint.
- Then sweeps: record-status (Q2) → lead-polish §5-6 (Q5/Q6, Q7=keep) →
  agent-review → ci-deploy-supplychain (CSP live-verify) → tighten-code-quality-
  ratchet (LAST, so all new files ≤250). Then final gate+integration+push.

## Recovery if session dies mid-epic

Uncommitted schema+shared work is on disk + the DB is reshaped. `git diff --stat`
shows it. Do NOT `migrate deploy` (skips the edited init) — only `migrate reset`
re-applies. Continue Phase C from apps/api, reach `pnpm typecheck` green, commit
the epic as one coherent unit, THEN push.
