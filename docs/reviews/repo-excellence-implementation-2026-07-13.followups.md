# Repo-excellence implementation — adjudicated follow-ups (2026-07-13)

The overnight autonomous run landed all 45 backlog changes (44 implemented,
1 empirically refuted) through an implement → 2 adversarial verifiers → full
gate → Codex review pipeline. Every blocker was resolved before its commit;
this file is the durable record of findings that were deliberately
DOWNGRADED, REFUTED, or DEFERRED — the honest remainder, none of it landed
silently.

## Review-pipeline scoreboard

- 15+ confirmed major findings fixed pre-commit (TOCTOU races → CAS/row-lock
  house patterns, dropped array bound on the submit schema, per-IP limiter
  collapsing behind the Next proxy, enforcing CSP that would have broken
  hydration, fail-closed limiters on Redis blips, leap-day window drift,
  double-counted republish leads, negative slide index, dead snapshot-path
  query, focus-priority and single-fire UI defects, and more).
- 3 premises REFUTED empirically (measurements in the linked commits):
  - `search-headline-post-limit` — Postgres ≥9.6 already defers expensive
    target-list expressions past Sort/Limit; archived unimplemented.
  - `redis-health-failfast`'s prescribed `enableOfflineQueue: false` —
    deterministic false "down" on the first lazy-connect ping; replaced with
    `commandTimeout`.
  - `enable-prod-tracing`'s baked-in collector default — reported "started"
    while silently exporting to a nonexistent host; replaced with explicit
    opt-in.
- 2 review claims REFUTED (README env-var claim; Codex's "focus the
  destructive button" — ARIA alertdialog practice is the opposite).

## Open follow-ups (deferred by scope discipline, none load-bearing)

### Tests / flake

- `apps/api/src/lib/logger.test.ts` throttle-count assertion flakes under
  full-suite parallel load (passes isolated). Loosen or serialize.
- Review-verdict: no end-to-end test pins the service-level judgedVersion
  sourcing (`input.version`); the repo-level lock masks it.
- PDF readiness: waitForSelector timeout branch untested; no assertion pins
  waitForSelector-before-pdf() ordering; readiness-failure→markExportFailed
  wiring untested end-to-end.
- Carry-over: race tests exercise pre-existing state, not a live
  two-transaction interleaving; published-variant of the abort test
  uncovered (archived variant only); theoretical stableId-undefined
  duplicate path.
- Rate limiting: integration tests rebuild express apps — the actual
  main.ts mount lines are unguarded by tests; the 80% Redis-memory warn
  boundary and log payload are unpinned.
- Redis health: unit tests stub the client; a live lazy-connect smoke
  belongs in the deploy healthcheck environment.
- Admin snapshot restore: fresh-DB create-path (new group + new head user)
  FK ordering untested; some committed test titles carry change slugs
  (in-file precedent exists; sweep didn't touch test titles).

### Product / UX seams (declared Non-Goals of their changes)

- Reminders and Periods settings sub-tabs still reseed over in-progress
  edits (the dirty-guard landed only in Identity/Notifications by scope).
- Dev-only role-switcher keeps the fire-and-forget logout redirect the
  nav-bar dropped.
- Trends window upper bound is `today`: a mid-week published current report
  is excluded (declared behavior — watch in prod).
- Slides clamp is post-commit (one-frame flash on shrink); useLayoutEffect
  if it ever matters.
- Snapshots frozen before the cross-group-audit change carry no
  ownerGroupId and emit no cross-group signal (documented residual).
- Reaped deadline/escalation reminders resend with the legacy plain payload
  (template fields are not persisted on the execution row).
- PII redaction is exact-key only (nested objects and error strings pass
  through, by declared design); the OTel sink isn't pinned by the redaction
  test.
- Case-variant UUID duplicates still 500 on the activity create path
  (normalize case in the refine + dedup); one vacuous test assertion
  (newActivityId) worth dropping.
- /health and /metrics remain unlimited (pre-existing; the rate-limit spec
  prose over-claims "every ingress surface").
- `canArchive` derives from periodState while the archive CAS keys on
  periodStatus — unreachable divergence today; key both off periodStatus
  for symmetry someday.

### Infra / dependencies

- pgbouncer: newer lines (1.23+) exist upstream; the pin corrected the
  never-published 1.22.1-p2 to registry-verified 1.22.1-p0. Upgrades go
  through the dependency-currency process.
- CSP floor carries `script-src 'unsafe-inline'` (Next App Router inline
  Flight scripts; Caddy cannot thread a nonce). Nonce-based hardening would
  need Next-level CSP emission.
- `metrics.registry.ts` remains over the 250-line budget (documented
  exemption; candidate for a split).
- Server-side merge gate: provisioning the CI runner + required status
  checks is the recorded pre-production-point requirement
  (openspec/specs/ci-merge-gate).

### Discipline backlog (separate sessions, manual per-folder)

- Exemption teardown: ~8 of the 27 documented lint exemptions are genuinely
  shrinkable (users-tab, groups-tab, period-admin.service,
  report-sections.prisma-repository, metrics.registry, …). Do manually, one
  folder per session — the automated rollout was evaluated and rejected
  (2026-07-07).
- A few UI-layer files still import Mock\* types from the mock module
  (reminders-tab.tsx, policy-row.tsx + test) instead of the feature's
  admin-types boundary — the model files were repointed; the UI consumers
  are the cheap remainder.

## Verification posture

Every change passed: prisma generate → typecheck → full lint chain → unit
suite (~1,690 tests) → real-DB integration suite (~300 tests) before its
commit; high-stakes changes additionally had their diffs reviewed at the
orchestrator level. NOT yet done: a live browser drive of the four roles
(ai-ui-driver) against the built app — recommended as the next session.
