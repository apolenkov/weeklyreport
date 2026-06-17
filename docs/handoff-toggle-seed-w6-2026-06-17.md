# Handoff — implement 3 planned changes (2026-06-17)

Repo `/Users/wrk/work/customreport`. Branch **`fix/dev-reseed-tiers-and-small-seed`**.
Plans are committed (`043599b2`) and `openspec validate --strict`-clean. This is a
thin pointer — the OpenSpec change dirs are the source of truth; read them, don't
trust this summary for detail.

## State at handoff

- Grill (`grill-with-docs-codex`) is DONE. User signed off the plan; implementation
  starts fresh (this session).
- Three change plans authored + Codex-reviewed. NO production code written yet.
- `PR #14` (https://github.com/apolenkov/yourpulse/pull/14) carries the lead-scope
  first cut (own-records default, already implemented + live-verified) PLUS these
  new plan docs. The lead-scope CODE is correct for the **default (Mine only)**
  behaviour; the toggle is net-new work on top — PR #14 is now "plan ahead of code"
  for the Everyone state, which the toggle change closes.

## The three changes (recommended order)

Read each dir fully before coding: `openspec/changes/<name>/{proposal,design,specs,tasks}.md`

- its `PLAN-REVIEW-LOG.md`.

1. **`fix-published-empty-stage-risk-floor`** (do FIRST — smallest, isolated, has a
   confirmed bug). Published/head/PDF product status reads GREEN when the only
   non-green signal is an OWNED-but-statusless stage covered by the author's own
   at-risk/blocked risk. Fix: fold own covering risks into a DERIVED
   `effectiveWorstStatus` at the read layer for all published readers
   (portfolio cards, head/weekly, PDF totals) — never mutate `StageStatus.status`
   (preserves the W11 empty-stage completeness guard + X/7 counter). Filter risks
   by `risk.projectId === product.id` BEFORE the stage-name match. Write the missing
   API regression test FIRST (blocked own covers-all → red; at-risk → yellow). Slide
   deck already floors correctly — out of scope. Full audit:
   `/private/tmp/.../tasks/w745vzozn.output` (task w745vzozn) if still present.
   Own branch/PR.

2. **`realistic-small-demo-seed`** (small, independent). `small` tier stays ONE lead
   (Vasily); give "Внутренний BI" all 7 stages owned + green (showcase a green
   product); render an unowned stage muted, not a loud "— unassigned / Contact
   admin" error state (`stage-chip.tsx`). Seed-data + display only, no schema/API.
   Update any small-tier test snapshots that asserted old BI shape; leave middle
   (`seed-simple.ts`) + fixture (`seed.ts`) untouched. Own branch/PR.

3. **`scope-lead-report-to-own-contribution`** (the toggle — biggest; revises the
   lead-scope change on THIS branch, stays in PR #14). Read `design.md` D4–D6
   carefully. Crux:
   - One lead-FORM "Record visibility" toggle: **Mine only** (default) / **Everyone**.
     English UI label.
   - **Two-tier read (D4a):** status-only `crossAuthors` (already shipped) is fetched
     ALWAYS and drives honest product-health colour in BOTH states. The full-content
     read (foreign item/risk/decision text + FULL author name + foreign chips) is a
     NEW gated read, fetched ONLY in Everyone. Re-introduces a gated version of the
     `crossAuthorSections`-style read that PR #14 deleted.
   - **Authz (D6):** full-content read gated by report-access AND product
     co-ownership for ALL callers — NO head/admin bypass. Status-only read keeps its
     shipped gate (report access). Negative + positive authz matrix tests required.
   - **View-only (D4b):** toggle never changes submit / publish / export.
   - **Persistence (D4c):** localStorage key namespaced by `{userId}:{reportId}`
     (shared-browser / dev role-switcher leak risk); default Mine only.
   - **Purge:** switching Everyone→Mine only AND logout / role / report / product
     switch / authz downgrade MUST purge fetched foreign content from query cache +
     state + DOM.
   - Slides: toggle does NOT apply; slides stay own-records-only + honest health.

## Gotchas / standing rules

- Static production UI strings stay ENGLISH; Russian only as seed/DB/test data.
- `npx prisma generate` before every gate/commit (.prisma client gets wiped).
- Integration tests are EXCLUDED from `pnpm test` — run
  `pnpm --filter @customreport/api test:integration` (needs the `_test` DB).
- Gate: `npx prisma generate && pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- Push to a feature branch + PR only (pre-push runs tests). Branch hygiene rules apply.
- The earlier lead-scope work left an inert dead-foreign-render cleanup deferred
  (see `scope-lead-report.../tasks.md` Deferred section) — the toggle work REVIVES
  some of that plumbing (the gated content read), so reconcile rather than delete.

## Verify

Per change: implement → gate → `openspec validate <name> --strict` → live-verify on
the relevant seed (middle `seed-simple.ts` has co-owned products for the toggle;
small for the seed change) → archive via `opsx:archive` after merge.
