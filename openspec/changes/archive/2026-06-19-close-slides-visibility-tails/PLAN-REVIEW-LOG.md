# Plan Review Log — close-slides-visibility-tails

Act 1 (grill-with-docs) complete — plan locked, CONTEXT.md verified, decisions
recorded in design.md. MAX_ROUNDS=5.

Act-1 locked decisions (you ↔ Claude):

1. ComingSoon affordance for per-author row tags is hidden in fullscreen
   presentation — working-view hint only, not on the projected deck.
2. All four tails ship as ONE change / ONE PR.
3. Act-2 uses the real Codex via the plugin runtime (the raw `codex exec` hangs
   on the corp proxy; the broker channel works).

Pre-skill check: an Opus adversarial reviewer ran before this skill and reached
APPROVED after one REVISE round; that informed the plan but the authoritative
Act-2 grill is the Codex loop below.

## Round 1 — Codex (Act 2)

VERDICT: REVISE. Three findings (all TASK/coverage, no correctness hole in the
fix itself):

1. The "no-fetch on every host" spec clause is tested only on the lead-form host;
   `LeadSlidesClient` left assert-by-inspection. Fix: test the slide client too,
   or extract the own-deck guard into a tested function.
2. The "hide in fullscreen" requirement has no scenario/test coverage.
3. The plan assumes `isFullscreen` is reachable in `LeadSlidesClient`, but it is
   private state inside `SlideFullscreenButton` — nowhere to read it from. Fix:
   lift fullscreen state into a shared hook both components read.

### Claude's response (round 1 → 2)

Accepted all three.

1. Extracted a pure predicate `crossAuthorContentFetchEnabled(...)` both hosts
   call; unit-test pins the truth table incl. the foreign-deck row, so the
   "every host" clause is genuinely tested by one function (Codex's endorsed
   fix). Kept the lead-form integration test for the foreign-`authorId` case.
   (design.md "Test coverage — shared tested predicate"; tasks 1.1/1.2/1.4.)
2. Added a fullscreen-hidden component test (simulate `document.fullscreenElement`
   / fire `fullscreenchange`). (task 2.5; spec scenario already covers fullscreen.)
3. Extract a `useIsFullscreen` hook (reads `document.fullscreenElement`,
   subscribes `fullscreenchange`); refactor `SlideFullscreenButton` to use it;
   the affordance reads the same hook — no state-lifting. (design.md "Fullscreen
   source of truth"; tasks 2.1/2.3.)

`openspec validate --strict` clean. Re-submitted to the same Codex session.

## Round 2 — Codex (Act 2)

VERDICT: APPROVED. All three prior findings resolved (shared
`crossAuthorContentFetchEnabled` predicate + tested truth table incl. the
foreign-deck row; fullscreen-hide spec scenario + simulated-fullscreen test;
`useIsFullscreen` shared DOM-source hook for both the button and the affordance).
No new findings.

**Converged** in 2 rounds (REVISE → APPROVED). Plan locked, ready to implement.
