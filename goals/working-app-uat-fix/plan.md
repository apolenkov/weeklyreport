# Plan — Working-app UAT + fix (all roles, one goal)

## Solution approach

Check-first, then fix-all-to-green, autonomously, with maximal subagent
parallelism. The app is largely built; this goal verifies every role/screen
live, fixes every finding (strict — nothing deferred), adds the split-view
feature (lead edit+slides; head composite-status+slide with product/lead
grouping), and runs code-quality + Vercel best-practice passes. Opus only for
synthesis/conflict.

Tooling note: `agent-browser` screenshot daemon is broken — use **Playwright
MCP** (`mcp__plugin_playwright_playwright__browser_*`). Dev-login is GET
`http://localhost:3000/auth/dev-login?role=ROLE&email=ROLE@customreport.local`.
Always start from a FRESH dev server (stale `next dev` bundle was the prior
root cause).

## Ordered steps

1. **Bootstrap (orchestrator).**
   - Add `pnpm dev:fresh` (`rm -rf apps/web/.next && pnpm dev:watch`); restart fresh.
   - Verify Vercel best-practices skill/CLI present (`vercel-cli-with-tokens` /
     `deploy-to-vercel` skills exist); if a dedicated best-practices skill is
     missing, install/enable it. Confirm Playwright MCP works.

2. **UAT sweep — parallel by role (Haiku/Sonnet + Playwright MCP).** One browser
   session per role is safest (shared browser); sweep lead → head → admin →
   viewer, every screen + tab. Capture console errors, visual issues (jump,
   skeleton, overflow, contrast, grey-where-color), algorithmic issues (save,
   counts, nav, 404, stale). Write `.planning/audits/uat-findings-<date>.md`
   (severity-tagged). Reuse the existing `uat-findings-2026-05-22.md` as the seed.

3. **Verify existing (check-first).** Confirm already-built behavior live:
   priorityRank persist+dialog (done: `c55b89c`/`a96c44e`), revoke per-lead +
   Revoke All with a submitted lead (P6/P7 `134d9e0`), 0 console errors all roles
   (done). Mark each fact PASS/FAIL.

4. **Split-view feature (largest build — research first).**
   - Lead: edit + slides side-by-side in `/lead/report` (today `?mode=edit|slides`
     are separate; build a split layout sharing one draft state — files:
     `apps/web/src/components/lead/lead-form.tsx`, `report-shell/*`, slide
     components). No data duplication — single source.
   - Head: split-view of aggregated status + its slide form (read-only, no edit),
     with grouping toggle product↔lead in BOTH views (files: head report/dashboard
     components, `report-shell/scope-toggle`, slides deck). Reuse existing
     `ScopeToggle` (3-way) + slides components.
   - Research current best practices (React 19 / Next 16 split layouts) before building.

5. **Fix waves (Sonnet, parallel, file-boundary matrix).** Fix EVERY finding to
   green — visual (CLS≈0, skeleton dims, spacing/contrast) + algorithmic. Group
   by domain (lead / head / admin / viewer / shared) so agents don't collide.
   - **SDLC stage colour (UAT 2026-05-22):** in `sdlc-pipeline.tsx` /
     `stage-chip.tsx`, a cross-author (foreign) stage must render the REAL status
     colour (green/yellow/red), NOT grey; locked-for-edit stages show a lock icon
     beside them (read-only indicator) while keeping the status colour; the stage
     cell is coloured when there is ≥1 stage / risk / block. Trace the
     cross-author status→colour path; the lock must not override the colour.

6. **Code-quality passes (parallel).** Run `code-simplifier` + `code-modernization`
   - `code review` on touched code. Modernize ESLint/Prettier to current standards
     (Google config + combined eslint-prettier plugins) in `eslint.config.ts`; bump
     deps to latest compatible. Each as a scoped agent.

7. **Vercel best-practices audit.** Run the Vercel best-practice skill against the
   web app (perf, Core Web Vitals, Next 16 conventions); apply safe fixes.

7b. **Logging-coverage + perf audit (observability).** Audit that key paths are
logged to maximum useful coverage: incoming requests, tRPC procedures, DB
queries with timings, slow operations, errors (build on existing pino / OTel /
Prometheus-Grafana; `pnpm logs`, `pnpm logs:errors`, `pnpm observability:up`).
Add structured timing/slow-query logs where missing. During the UAT sweep,
capture logs and produce a perf-opportunities list — concrete `cache` and
`DB index` candidates tied to specific queries (use `database-optimizer` /
`postgres-pro` skills + Prisma query analysis). Apply evidence-backed wins
(indexes via append-only migration past `_destructive-guard`; cache where safe);
surface large ones in the roadmap. Files: `apps/api` modules, `prisma/`,
observability config.

1. **Gates + per-fact verification (orchestrator).** `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, `pnpm lint:md` all green; map each accepted fact to a concrete
   check (e2e/unit/manual); re-sweep to confirm 0 console errors + no jump.

## Verification (per fact)

```bash
pnpm dev:fresh                 # fresh server (no stale bundle)
pnpm typecheck && pnpm lint && pnpm test && pnpm lint:md   # gates
pnpm test:e2e -- <touched specs>                            # role flows
# Playwright MCP re-sweep: 0 console errors per role; CLS≈0; revoke live; split-view
```

- render-clean → Playwright console=0 per role.
- priorityRank → e2e set→reload→reopen persists.
- lead/head split-view → e2e + manual: both panes, single source, grouping toggle.
- head-pulse / revoke → e2e with submitted-lead seed.
- no-jump → CLS trace ≈ 0.
- frozen → `git diff` touches none of AI/RAG, theme, i18n, holidays, telegram, director.
- gates → all four commands exit 0.

## Risks / open questions

- **Split-view is a real feature build**, not just verification — biggest effort;
  needs a small design pass (layout, state sharing) before coding.
- **"Fix ALL to green, nothing deferred"** is open-ended; if a finding implies a
  large feature or schema migration, surface it (the only allowed escalation) —
  otherwise fix surgically and autonomously.
- Browser tooling flakiness — Playwright MCP only; one session per role.
- Package/ESLint modernization may surface pre-existing debt; keep changes
  green-gated and scoped.
- Context budget — run as a fresh `/goal` session; delegate heavily so the
  orchestrator stays lean.
