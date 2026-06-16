# Handoff → next session (2026-06-16, wrap at ~700k tokens)

## fix-report-surface-integrity — DONE, frozen in main, archived

- All 11 work-streams (W1–W11) implemented and pushed to `origin/main` (the tip of `main` is
  this change's work plus the spec-sync + handoff commits; run `git log --oneline -20` for the
  exact SHAs rather than trusting a pinned hash here).
- Change archived: `openspec/changes/archive/2026-06-16-fix-report-surface-integrity/`.
  `openspec list` → no active changes.
- Verified: full gate GREEN (prisma/typecheck/lint/test web 1131 + api 920/build +
  `openspec validate --strict` on the change). Live UAT (Haiku+Playwright, 4 roles) clean.
- Codex CODE review (4 fresh-session rounds): every behavioral invariant PASS from round 2
  (W11 completeness reversal, W6 floor deviation, W7/W8 escalation parity, W2 authz + routing,
  Export-UI). See the change's `CODE-REVIEW-LOG.md`.

## Durable-spec sync (the stop-hook loop we were in)

The change archived with `--skip-specs` (openspec 1.4.1 archive rebuild aborts on accumulated
repo spec-debt), so the durable `openspec/specs/**` were hand-synced. Over several Codex
stop-review rounds we fixed, in the 5 specs this change touched, every spec-vs-code / self
contradiction:

- status-risk-unification: render-time floor vs raw read-model layer made explicit; mapper floors
  NON-empty, preserves EMPTY (+coveredByOwnRisk).
- lead-pipeline-card: W11 completeness reversal + chip distinction.
- role-coverage-gate: 9 canonical builders everywhere; pdfExport authz = leadershipProcedure
  (head/admin/viewer; lead FORBIDDEN); leadHeadAdmin orphaned-but-retained.
- report-toolbar-parity: archive toggle is a quiet state indicator, no count badge.
- All 5 now pass `openspec validate <spec> --type spec --json`.

If the Codex stop-hook flags ANOTHER spec drift: the pattern is always "durable spec wording
lags the shipped code." Read the cited file:line, reword to match the code, mirror the same edit
into the archived delta under the change dir, validate with the JSON command above. Do NOT change
code to match a stale spec — the code + tests are the source of truth here.

## Known remaining debt (NOT this change — for a dedicated openspec-hygiene change)

`pnpm exec openspec validate --specs --strict` → ~10 OTHER main specs FAIL (pre-existing, from
older sloppy archives): head-toolbar-semantics, health-indicator-service-migration,
lead-report-controls-integrity, lead-slide-quadrants, lead-surface-name-resolution,
manual-publish-telemetry, scope-accessed-audit, web-test-timer-discipline, web-trpc-test-harness,
client-error-policy. Typical fixes: add `## Purpose`; replace a leaked `## ADDED/MODIFIED
Requirements` header with `## Requirements`; give each requirement a MUST/SHALL. See memory
[[openspec-archive-spec-debt]].

## One unverified-live item

W6 floor through the PUBLISHED PDF-export path is test-guarded at product-`worstStatus` level but
never eyeballed: publish a report with an empty-but-own-risk-covered stage, export the PDF, confirm
the product status reflects the risk.

## Other open backlog (separate work-streams, new session)

From the task list — these are NOT fix-report-surface-integrity and were not touched here:
verify-pilot-and-followups, design-system-tokens, responsive-tracker-ui, the ai-ui-driver final
walkthrough, PRJ incremental backfill (9–10 June commits), Demo-weekly-roundup reformat. Re-confirm
which repo each belongs to before starting.
