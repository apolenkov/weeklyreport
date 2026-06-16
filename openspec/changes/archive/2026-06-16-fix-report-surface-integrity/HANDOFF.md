# Handoff — fix-report-surface-integrity

For a FRESH session that implements this change via Workflow. Read this, then
`proposal.md` → `design.md` → `tasks.md`. The plan is locked + Codex-APPROVED (7 rounds,
see `PLAN-REVIEW-LOG.md`). User signed off 2026-06-15.

## Kickoff prompt (paste in the new session)

> Реализуй OpenSpec-change `fix-report-surface-integrity` через Workflow, по его `tasks.md`.
> Сначала прочитай proposal.md → design.md → tasks.md → PLAN-REVIEW-LOG.md в папке изменения.
> Перед стартом подтверди: матрица экспорта, поведение `/present`+`/print`, разворот
> `lead-pipeline-card` (W11), и паритет live↔snapshot. UltraThink на спорных местах.

## Branch / git

- Work on `feat/fix-report-surface-integrity` (created this session). The change artifacts +
  the `lead-summary-table.tsx` pill fix are committed here.
- Push to main is via branch + PR (repo norm). Do NOT push to main directly.

## What's already done

- Status-pill wrap fix in `apps/web/src/components/dashboard/lead-summary-table.tsx`
  (`whitespace-nowrap`) — landed in the first commit on this branch.

## Must-remember gotchas (cost real time last session)

1. **`npx prisma generate` before every gate/commit** — the .prisma client gets wiped by pnpm
   ops; a TS2339 on a known model means "regenerate", not a real error.
2. **Live ↔ published-snapshot parity is mandatory** for W6 (floor) and W7 (escalation stage):
   touch `buildEscalations` AND `buildEscalationsFromSnapshotSections` (or extract one shared
   builder), and the read-model mapper AND the PDF-worker/print template.
3. **W11 reverses a locked invariant** (`lead-pipeline-card`): count OWN risks only, foreign
   risks never count, stage-less legacy risk = 0, derive `coveredByOwnRisk` (reload-stable),
   rewrite the old reload-stability test (don't silently delete it).
4. **Export authz**: reuse the existing `leadershipProcedure` (head+admin+viewer) at
   `apps/api/src/infrastructure/trpc/trpc.middleware.ts:517` for `pdfExport.request/status`;
   lead FORBIDDEN. No new builder needed.
5. **`/print/[id]` stays** the PDF-worker template — never delete it; only remove the human
   Print link and add the worker-vs-human auth discriminator.
6. **W9 telemetry keying** (`status` vs `periodStatus`) is discovery-gated — do NOT change it
   without a failing test proving divergence. The "ACTIVE LEADS" relabel is the only safe part.
7. **File-deletion anomaly (this session):** root-level `PLAN.md` / `PLAN-REVIEW-LOG.md` were
   deleted from disk twice and a tracked `main.ts` edit reverted, while the openspec dir
   survived. Cause unknown (no parallel process found). That's why the review log lives in this
   dir, not at repo root. If files vanish again, COMMIT early.

## Gates

`npx prisma generate && pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
Then `openspec validate fix-report-surface-integrity --strict`. Archive only after PR merge.
