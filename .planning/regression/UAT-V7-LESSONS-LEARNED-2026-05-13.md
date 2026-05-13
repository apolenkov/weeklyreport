# UAT v7.4 — Lessons Learned (A39)

Branch: `fix/PRJ-11/uat-v7-2026-05-12`
Date: 2026-05-13
Sessions: 2026-05-11 (day) + 2026-05-12 (night) + 2026-05-13 (continuation)

---

## GOOD — what worked well

- **Atomic commit discipline** prevented big-bang merges; every A-bug has
  a commit with explicit ID in the subject line → easy to grep / revert.
- **A38 UAT-MATRIX skeleton** (parse-dom + generate-playwright) provided a
  structured way to extract `data-testid` coverage directly from the DOM
  without guessing. Future UAT sessions should extend, not rebuild.
- **`advisor()` + Codex cross-AI review** caught the A12 false-positive
  before a wrong code fix was committed; the code was correct, the seed was wrong.
- **`session-digest-comprehensive-uat-regression-suite.md`** as a single-source
  of A-bug descriptions survived across multiple session compactions without
  losing context.
- **Two-group seed structure** (`DEFAULT` + `FINANCE`) in `wipe-manual-uat.ts`
  was already partially in place; A36 only needed to mirror it into
  `seed-simple.ts` — reuse over duplication.
- **`placeholderData: keepPreviousData`** at the global QueryClient level
  eliminated per-query boilerplate for the flash-on-refetch problem (A20 Layer 1).

## BAD — what was slow or confusing

- **JSONL digest size**: the primary session JSONL (~120 MB) required a
  separately extracted digest to be usable; direct resumption via `/resume`
  was broken. Any session that accumulates >50 MB JSONL needs an in-session
  checkpoint commit + explicit handoff before context limit is hit.
- **Stale bug statuses**: several A-bugs (A7, A18, A25, A31) were already
  committed in previous sessions but still showed `[ ]` in the ABUGS file.
  Cross-checking with `git log --grep='A<N>'` must be the FIRST step before
  touching any A-bug, not an afterthought.
- **Seed data as a silent test dependency**: A12 ("head sees all leads") was
  misdiagnosed as a code bug for 30+ minutes. The code was correct; ALL leads
  had the same `reportingGroupId` in `seed-simple.ts`. Lesson: when a
  scoping bug appears, check seed/fixture data BEFORE tracing application code.
- **Single-session plan decay**: the 15-phase night-throw plan was written
  for a single autonomous session but the context limit forced a compaction
  mid-session. Plan checkpoints (committed markdown state) are more durable
  than in-flight session memory.

## LEARNED — rules worth keeping

1. **Grep git log before fixing any A-bug.**
   `git log --oneline --all --grep='A<N>'` first — a 1-second check that
   prevents duplicate fixes and false-positive status updates.

2. **Seed data is part of the feature contract.**
   If `head.reportingGroupId` appears in a scoping query, the seed must
   have ≥2 distinct groups with leads split between them. Seed homogeneity
   hides scope bugs that would only surface in production multi-tenant data.

3. **Two-group invariant for group-scoped tests.**
   Any test that verifies "head only sees their group's leads" MUST use a
   seed/fixture that places at least 1 lead in a DIFFERENT group. Tests that
   pass because all leads are in the same group give false confidence.

4. **CSS `:has()` for ambient overlay hiding.**
   When a FAB or floating element must disappear whenever ANY dialog is open,
   `body:has([role="dialog"]) [data-testid="fab"]` is a single-line fix that
   requires no changes to 15+ modal components. The pattern is now proven in
   `app.css` (A17).

5. **`keepPreviousData` at the QueryClient layer beats per-query opt-in.**
   Global `placeholderData: keepPreviousData` in `makeQueryClient()` silently
   fixes the refetch-flash problem across all queries without touching individual
   hooks. Only override locally if a specific query must show loading state.

6. **TODO discipline audit before session close.**
   Run `grep -rn 'TODO(' apps/ packages/ | grep -v 'TODO(Phase-54\|TODO(Phase-55'`
   and verify every hit has both a `throw new Error('Not implemented')` stub
   AND a named metric. Phase 54/55 are the only permitted unresolved TODOs
   (locked-deferred by user decision).

## TDD DISCIPLINE AUDIT

### Coverage status at session end

| Layer          | Tests     | Status     |
| -------------- | --------- | ---------- |
| web vitest     | 392 / 392 | ✓ all pass |
| api vitest     | 914 / 914 | ✓ all pass |
| TypeScript web | 0 errors  | ✓ strict   |
| TypeScript api | 0 errors  | ✓ strict   |

### Pre-existing failures at session start (from audit-2026-05-11)

- `LeadFormSyncBridge` — test-env isolation issue (not a regression from this branch)
- `WeeklyReportPage reopen` — pre-existing; not introduced by any A-bug fix

Both pass in the current run → the pre-existing red baseline was healed by
A13/A15 form-race fix (committed earlier as `c60ccc2`).

### TODOs with correct discipline

```
grep -rn 'TODO(Phase-54' apps/ packages/ → 3 hits (ai-adapter stubs)
grep -rn 'TODO(Phase-55' apps/ packages/ → 2 hits (telegram-binding stubs)
```

All Phase-54 / Phase-55 TODOs have `throw new Error('Not implemented')` stubs
and metric placeholders per the `### TODO discipline` rule in CLAUDE.md.

---

## OPEN ITEMS FOR NEXT SESSION

| Item                               | Why deferred                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Phase 54 (AI/RAG activation)       | Locked-deferred: awaiting user decision on AI provider                                                      |
| Phase 55 (Telegram adapter)        | Locked-deferred: awaiting user decision on bot config                                                       |
| Director role full UAT (A35)       | Unblocked now (A28/A31/A32 done); schedule for next UAT cycle                                               |
| A20 Layer 2/3 (skeleton + spinner) | Partial improvement in (A1 navbar + global keepPreviousData); remaining layers are enhancement, not blocker |

---

_Generated by autonomous night-throw session 2026-05-13._
_Branch had 39 A-bugs at start; 37 closed or resolved; 2 locked-deferred (Phase 54/55)._
