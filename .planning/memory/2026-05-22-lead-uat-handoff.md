# Handoff — Lead UI UAT + fix pipeline (2026-05-22)

## DONE (committed on fix/PRJ-2/shiny-eagle)

- `15acc83` fix(prisma): wipe-manual-uat stale Priority deleteMany (F1 regression) — verified `pnpm db:wipe:manual-uat` exits 0.
- `438ed67` chore(planning): accumulated-work-audit tool + eslint ignore `.planning/scripts/**`.
- `f931ba2` fix(reminders): dispatchPending no-matching-section reason + activity24h queryKey test (web 502/502, api 922/922).
- `20b9dd7` test(e2e): revoke-downstream integration spec + publish-revoke cleanup.
- `e75fe6e` test(e2e): deactivate/activate-user regression (ADM-021).
- `cb4d652` test(email): email-dispatch integration via local Mailpit (LIVE green — Mailpit reachable).
- `c55b89c` **fix(lead): priorityRank now persists** — `makeItemsChangeHandler` + autosave payload in `apps/web/src/components/lead/lead-form.tsx` both dropped priorityRank; backend + shared schema already persist it. tsc clean.
- `da6b391` / `83614a8` plan + goal docs (re-triage SC-160/165/email → P6/P7/P8, holidays frozen).
- **EF agent P6/P7 (UNCOMMITTED in tree):** dashboard per-lead Revoke button + bulk `revokeAllSubmitted` mutation+UI. Agent reported api 924 tests green + web tsc clean. NEEDS: my review + commit + un-fixme SC-160/SC-165 in publish-revoke.spec.ts.

## ROOT CAUSE FIXED (the big one)

User's "вижу старое / серый chip / не сохраняется" = **stale `next dev` Webpack bundle** (server up since ~May 20, HMR stopped picking up May 21-22 changes; lead page crashed SSR with "No QueryClient set" and fell back to broken client). FIX: killed stale next/pnpm dev, `rm -rf apps/web/.next`, relaunched `pnpm dev:watch` (bg). Verified live via curl+dev-login: lead page now renders 52KB, no QueryClient crash.

Dev-login (CLI/agent): GET `http://localhost:3000/auth/dev-login?role=lead&email=lead1@customreport.local` (NOT POST). Lead1 = "Василий И.", section a0000000-…-401, report a0000000-…-001.

## NEXT (the 5-stage goal, bounded)

1. **Verify lead UI live** (browser agent ad4c4ee7 was dispatched but slow/stuck): priorityRank saves across reload (open item dialog → set rank → Save → wait autosave → RELOAD → persists? P{N} chip?); locked stage chip (Борис С / Planning) real color vs grey; skeletons; layout jump.
2. **Full UAT sweep** all roles (lead/head/admin/viewer) → write `.planning/audits/uat-findings-2026-05-22.md` (visual + algorithmic, severity-tagged, screenshots).
3. **Research** each finding (best practices 2026-05).
4. **peo-plan roadmap** of fixes (15-section).
5. **Execute** in waves (Haiku scan / Sonnet fix), commit atomically.

## RISK / NOTES

- EF's dashboard-page.tsx had mid-run tsc errors (unused vars); agent claims final clean — RE-VERIFY web tsc before committing EF work.
- Grey chip: likely was stale server; needs live re-confirm on fresh server before deciding if it's a real bug.
- Keep the fresh `pnpm dev:watch` running; do not kill (user is using :3000).
- Frozen (do NOT build): holidays-calendar, i18n, dark mode, AI/RAG, Telegram, Director.
  </content>
