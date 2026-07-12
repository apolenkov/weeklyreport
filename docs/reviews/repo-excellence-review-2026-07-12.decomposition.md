# Decomposition consensus — repo-excellence backlog → OpenSpec changes

Date: 2026-07-12. Inputs: report (`repo-excellence-review-2026-07-12.md`),
Phase-A re-verification (`.verify2.md`, 24 adversarial verifiers: 15 CONFIRMED /
7 NUANCED / 2 REFUTED), and a two-seat council (Codex fresh session + a
deep-reasoner seat on Opus), same brief, blind to each other. Adjudicated by the
session architect. Council raw answers preserved in the session scratchpad.

## Council convergence (both seats independently)

- **Drop `fix-policy-backfill-timezone`** — BL-19 REFUTED; residuals: dead `_tz`
  param + duplicated `computeFireAt` → `remove-dead-code`; stale docstrings →
  the merged comment change.
- **Drop standalone `dockerfile-web-fail-safe-auth-defaults`** — BL-21 REFUTED
  (prod build neutralizes the flags); residual hygiene folded into
  `prod-security-hardening`.
- **Merge `fix-stale-comments` into `comment-hygiene-archaeology`** — duplicate
  cross-cutting comment sweeps; 403-copy fix kept as explicit acceptance criterion.
- **CN-01 remedy as written is WRONG and dangerous** — both seats independently:
  BullMQ requires `noeviction`; `allkeys-lru`/`volatile-lru` would silently
  corrupt queue state. Rewritten remedy: KEEP `noeviction`, set `--maxmemory`
  ≈200M (below the 256M cgroup ceiling), add bounded `removeOnComplete`/
  `removeOnFail` retention (absent today), DLQ reaper, memory alerting. P2.
- **BL-15 → P2** (concurring with GLM and Phase A); spec carries a dated
  acceptance gate (must land before 2027-01-01).
- **Seam chains to serialize at implementation time:**
  - `sync-playwright-prod-image` → `print-error-state-and-pdf-readiness` →
    `env-config-no-fallback-sweep` (pdf-export.processor.ts)
  - `reliable-reminder-delivery` → `redact-pii-logs` (reminders files)
  - `fix-published-crossgroup-audit` → `micro-perf-hot-paths` (weekly-report repo)
  - `prod-security-hardening` is the deploy magnet — lands LAST among deploy
    changes (after playwright-image, caddy, tracing, healthchecks)
  - queue job-options shared by CN-01 / BL-35 / BL-09
  - all cross-cutting cleanup (comment sweep, dead-code, duplicated-types,
    web-polish) lands dead-last
- **Guardrail applications:** `auth-session-hardening` keeps ONLY logout
  Origin/CSRF + response-ok handling and documents the 1h stateless-logout
  tradeoff — no jti/revocation, no head-lifecycle authz (declined);
  `centralize-duplicated-types` = dashboard CHART palette only, print color
  stays non-tokenized; `atomic-publish-snapshot` hardens the existing
  `publishedSnapshot` (references publish-compare-and-set), not a
  versions/snapshots revival; `sync-playwright-prod-image` references
  `dependency-currency`; `server-side-merge-gate` framed as a
  pre-production-point requirement; nothing splits `report.schema.ts`.
- **Fact correction (reasoner, verified):** `StageAssignment` already has
  `@@unique([stageId, projectId])` — `stage-assignment-upsert` is an api/admin
  code change only, no migration.

## Adjudicated disagreements

1. **BL-22 / BL-23 granularity** — Codex: fold into `web-polish-lows`;
   reasoner: keep separate at P2. **Ruling: keep separate.** Phase A confirmed
   both as real P2 mechanisms in distinct components with distinct verification;
   burying P2 correctness in a P3 polish batch hurts traceability more than two
   small changes cost.
2. **Caddy change wave** — Codex: wave 3; reasoner: wave 2, reframed as
   CN-03-driven. **Ruling: wave 2.** The change is now
   `caddy-staging-headers-and-api-matcher`: CN-03 (staging ships no HSTS/CSP at
   all — real P2 security gap) is the driver; the BL-20 matcher fix rides along
   as P3 residual. Codex's wave-3 placement priced it as BL-20-driven, which the
   reframing supersedes.
3. **Observability split** — reasoner: two changes; Codex: task-level split is
   enough. **Ruling: two changes** (`enable-prod-tracing`, `deploy-deep-healthchecks`)
   — different concerns, urgency, and rollback paths.

## Final change list — 45 changes

**Wave 0 — P0 (4):**
`fix-report-section-write-gates` (BL-01, corrected: already-submitted guard
exists; residual hole = draft sections in published reports; gate both writes
on periodStatus), `guard-period-reopen-cas` (BL-02),
`close-leadform-read-leaks` (BL-03), `sync-playwright-prod-image` (BL-06).

**Wave 1 — P1 (6):**
`review-verdict-version-lock` (BL-05, demoted P0→P1),
`print-error-state-and-pdf-readiness` (BL-07, demoted P0→P1),
`atomic-publish-snapshot` (BL-08), `reliable-reminder-delivery` (BL-09),
`rate-limit-public-endpoints` (BL-11 + CN-02),
`fix-wipe-uat-activity-tables` (BL-13).

**Wave 2 — P2 (31):**
`idempotent-carry-over` (BL-04, demoted P0→P2), `admin-snapshot-head-restore`
(BL-10), `fix-analytics-query-correctness` (BL-12), `redis-health-failfast`
(BL-14), `dynamic-trends-window` (BL-15), `fix-org-settings-form-safety`
(BL-16), `dedup-linked-products` (BL-17), `fix-published-crossgroup-audit`
(BL-18), `fix-list-empty-state-source` (BL-22), `clamp-lead-slides-index`
(BL-23), `redis-write-path-resilience` (CN-01, REWRITTEN remedy),
`caddy-staging-headers-and-api-matcher` (CN-03 + BL-20),
`inject-app-logger-di` (BL-24), `env-config-no-fallback-sweep` (BL-25 + CN-05
SAML superRefine as first task), `enable-prod-tracing` (BL-32),
`deploy-deep-healthchecks` (CN-04), `redact-pii-logs` (BL-33),
`server-side-merge-gate` (BL-34), `auth-session-hardening` (BL-37,
constrained), `bound-section-save-arrays` (BL-30), `search-headline-post-limit`
(BL-28), `carry-over-fk-indexes` (BL-41), `stage-assignment-upsert` (BL-40, no
migration), `telegram-processor-baseclass` (BL-35), `web-type-ssot-drift`
(BL-29), `web-nav-and-query-perf` (BL-27), `a11y-dialog-listbox-cluster`
(BL-26, task 1 = establish hook, migrations follow), `seed-coverage-paused-postponed`
(BL-36), `test-coverage-activity-archive` (BL-39), `remove-dead-code` (BL-31 +
BL-19 dead-param residue), `prod-security-hardening` (BL-38 + BL-21 residue; 3
independently committable slices: CSP enforce / redis-backed limiters / digest
pinning; lands LAST among deploy changes).

**Wave 3 — P3 (4, dead-last):**
`micro-perf-hot-paths` (BL-42, per-optimization acceptance criteria),
`comment-hygiene-archaeology` (BL-43 + BL-46 + BL-19 docstring residue),
`centralize-duplicated-types` (BL-44, chart palette only),
`web-polish-lows` (BL-45).

Net: 47 recommended → 45 final (2 dropped/absorbed, 1 merged, 1 split into 2).
