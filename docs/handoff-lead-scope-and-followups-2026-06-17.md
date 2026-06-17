# Handoff — lead-scope change + follow-ups (2026-06-17)

Repo: `/Users/wrk/work/customreport`. Branch: **`fix/dev-reseed-tiers-and-small-seed`**
(local, NOT pushed). Run `git log --oneline -5` for exact SHAs — don't trust
pinned hashes. Memory auto-loads `lead-own-scope-decision-2026-06-17`.

## Bottom line

A grill-with-docs-codex session locked the lead-page scoping design and produced
a Codex-APPROVED OpenSpec change (plan only, no impl yet). Four commits are on the
branch. Two small follow-ups remain. Start a fresh session for the implementation.

## Branch state — 4 commits on top of `28cf248b`

1. `fix(dev): wire role-switcher reseed menu to small/middle/huge tiers` — done,
   live-verified (menu shows 4 items; `small` reseed ran end-to-end).
2. `feat(seed): reshape small demo tier to one lead, three products` — done,
   verified (Vasily owns 3 products: 2×Dev + 1×Dev+Test, one blocked item kept).
3. `docs(openspec): plan scope-lead-report-to-own-contribution` — the deliverable
   below.
4. `chore(shared): remove dead sharedRouter trpc stub` — done (0 consumers proven;
   shared tests 581 pass).

DB currently seeded with the new **small** tier (Vasily). `pnpm db:seed:middle`
restores the rich 9-product set if needed.

## The OpenSpec change to IMPLEMENT next

`openspec/changes/scope-lead-report-to-own-contribution/` — proposal/design/
specs/tasks, `validate --strict` clean, Codex APPROVED in 2 rounds
(`PLAN-REVIEW-LOG.md`).

**Decision (grill variant 2):** the lead page shows ONLY the lead's own records
(items/risks/decisions). A co-owned product's **health colour stays honest**
(reflects co-leads' stages) but as anonymized, status-only context — initials +
risk-derived colour, no foreign text/counts/names.

**Critical baseline fact (Codex caught this):** the lead page TODAY merges foreign
content via `leadForm.crossAuthorSections` (always-on) + `mapForeign*` in
`apps/web/src/lib/mappers/lead-cross-author.ts` → `mergedRisks` / `mergedDecisions`
/ `merged*Items` in `lead-form.tsx`. Implementing this change REVERSES that W5/W6
foreign-record merge on the lead surface. This is why the user said "I only want
to see mine" — they genuinely see others' records now.

Start implementation from `tasks.md` (Section 1 = shared/API contract first).
Use `openspec-apply-change`. Live-verify on the `middle` seed (Mobile is a shared
product: a tech lead owns Dev, a PM owns Plan/Analysis/Design).

## Remaining follow-ups (small)

1. **W6 live-verify** (the one open audit item): publish a report whose product
   has an empty stage covered by its OWN risk (severity at-risk/blocked), export
   the published PDF, confirm the product status is NOT green (the "floor"). The
   published path computes `worstStatus` separately
   (`apps/api/src/modules/published-report-snapshot.ts:163`); unit-tested at the
   mapper level but never eyeballed live. Low risk, just needs one look.
2. **Push / PR** the branch (currently local-only). User decides when.

## Gotchas carried from this session

- Codex hangs need a watchdog; macOS has no `timeout` — use
  `perl -e 'alarm N; exec @ARGV' codex ...`. Both Act-1 (questions) and Act-2
  (verdict) ran clean this way.
- The full audit of "what's undone" (workflow) concluded almost nothing is truly
  undone — the "abandoned work" feeling came from stale memory, now corrected
  (MEMORY.md index fixed: versions-v2 parked, FRSI/rethink-pipeline/require-risk-
  stage all archived, demo-feedback pushed).
- Gate: `npx prisma generate && pnpm typecheck && pnpm lint && pnpm test &&
pnpm build`. Machine is slow; commands often background.

## Suggested skills for the new session

- `openspec-apply-change` / `opsx:apply` — implement the change from tasks.md.
- `verify` / `run` — drive the app for the lead-scope + W6 live checks.
- `codex:review` — cross-model re-check of the implementation (≥540s watchdog).
