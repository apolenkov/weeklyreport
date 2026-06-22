# Handoff — lead-report feedback: IMPLEMENTED (2026-06-21, autonomous overnight)

## State in one line

All **five** OpenSpec lead-report-feedback changes are **implemented, gate-green,
and committed** on an isolated worktree branch. NOT pushed to `main`, NOT merged.
A clean **live-verify is blocked** by shared-environment contention (see below) —
the visual/geometry proofs are pending; everything else is green.

## UPDATE 2026-06-22 — 3 decisions resolved + live-verify done + pushed

The three open decisions are resolved and two follow-up changes shipped on the
SAME branch (now 13 commits, pushed to `origin`, PR #21 updated):

1. **Capacity numbers 6/5** — confirmed (kept `MAX_PRODUCTS_PER_LEAD = 6`,
   `SLIDE_SECTION_SOFT_CAP = 5`). No code change.
2. **A11y double-announce** — the user first chose "shorten the labels", but that
   would drop the only PERSISTENT coming-soon signal (browse mode). Reversed:
   the shared `ComingSoonTooltip` now passes a whitespace `aria-label` so Radix's
   auto description is blank — the control's own `aria-label` is the single
   source, no double-announce. Commit `75eafdac`; folded into change A.
3. **"+N more" tooltip restyle** — done now: scoped light-popover override on the
   collapsed indicator only (dark default untouched). New change
   `restyle-collapsed-stages-tooltip-surface`. Commit `7a8d8d54`.

Full gate re-run GREEN (typecheck / lint / **test 1257** web / build 5/5).

**Live-verify (2026-06-22, worktree web on :3000 vs the shared API):**

- A (tooltip clip-escape) ✓ — amber badge portaled to `body`, OUTSIDE the
  `overflow-x-auto` toolbar; describedby resolves to blank, aria-label intact.
- B (fullscreen exit) ✓ — enter works; Exit pill + toggle flip + the Exit pill
  exits and RETURNS FOCUS to the toggle. (Esc-to-exit is native browser, not
  triggerable via Playwright synthetic keys — trivial manual check.)
- C (quadrant overflow) ✓ — sparse Summary renders cleanly; DENSE (a product
  loaded to 6 Current-Week records via the real dialog on a huge reseed): the
  quadrant FRAME stays `overflow:hidden` hPhantom 0 (no horizontal phantom — the
  review-caught watermark regression), the INNER container scrolls vertically
  (scrollHeight-clientHeight = 361px) so rows are reachable. DB restored to small.
- "+N more" restyle ✓ — reveal renders on the light popover surface (screenshot).
- D (capacity advisory) ✓ — adding a 6th Current-Week record to one product
  surfaced "6 records may not fit cleanly on the slide" on that group, adding
  stayed allowed (screenshot).

All live-verify done. Remaining: archive the 5+1 changes, then the USER merges
PR #21 to `main` (the agent does not push the default branch).

## Where the work lives (isolated — a SECOND agent is active in the main tree)

- **Worktree:** `/Users/wrk/work/customreport-leadfeedback`
- **Branch:** `implement-lead-report-feedback` (off `main` @ `d87bee33`)
- The main checkout `/Users/wrk/work/customreport` is being used by ANOTHER
  agent. This session worked entirely in the sibling worktree with its OWN
  `node_modules` so the two never collide. The worktree shares only the
  content-addressed pnpm store and (read-only) the docker API/DB.

## The five commits (one per change, on the branch)

| Commit    | Change                                   | What                                                                                                   |
| --------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `7a42628` | C `fix-lead-slide-quadrant-overflow`     | dense Summary quadrants scroll (overflow-y-auto + min-h-0; floor moved to the grid track)              |
| `8cef358` | E `fix-lead-product-grid-card-alignment` | CSS subgrid: 4 bands align across product cards; always render the Risks+Decisions band                |
| `c869f32` | D `add-slide-capacity-signals`           | advisory soft caps (6 products / 5 records) — admin count + per-product section advisory, non-blocking |
| `29b8bc9` | B `add-slide-fullscreen-exit-affordance` | single `useFullscreen` owner + floating Exit pill + Esc hint + aria-pressed + focus-return             |
| `3ba1214` | A `fix-coming-soon-tooltip-clipping`     | 6 Coming-Soon controls → portaled Radix `ComingSoonTooltip` (escapes overflow clip); anchor deleted    |

## Gate — FULL repo, all green (run in the worktree)

- `npx prisma generate` ✓
- `pnpm typecheck` ✓ (5/5)
- `pnpm lint` ✓ (eslint + stylelint + prisma typecheck — "No issues found")
- `pnpm test` ✓ (**1253** web tests + api/shared/ui packages)
- `pnpm build` ✓ (5/5; Next compiled all routes — Tailwind subgrid/arbitrary classes OK)

## ⚠ FULL-APP LIVE-VERIFY IS PARTIAL — the residual gap

jsdom cannot prove the VISUAL/geometry fixes (advisor flagged C/A/E as
browser-only). **The two highest-risk mechanisms — C's scroll geometry and E's
subgrid band alignment — WERE browser-verified** this session via standalone
Chromium repros (steps 3 and 5 below). The remaining gaps are lower-risk in-app
visual checks: A (tooltip clip-escape — but Radix portals to `document.body`, so
escaping the overflow ancestor is structural) and the B fullscreen flow (needs
real fullscreen). A clean FULL-APP live-verify was **blocked tonight**, NOT
skipped:

- The shared docker API (`customreport-api-1`, :3002) has CORS pinned to
  `FRONTEND_URL=http://localhost:3000` and has been up 41h. The other agent owns
  `:3000` (web dev server). A worktree web on another port (e.g. :3010) fails the
  API's CORS; reconfiguring/restarting the shared API or reseeding the shared dev
  DB would disrupt the other agent — so it was deliberately NOT done.

### To live-verify (do this once you have a clean/own stack)

Bring up an OWN stack (own DB+API+web, or stop the other agent and use `:3000`),
seed richer data for the dense cases (`pnpm db:seed:huge` or `db:fresh:advanced`
on a NON-prod DB), then:

1. **A — tooltip clip (the original complaint):** lead `/lead/report` → hover the
   "Agent review" toolbar control → amber tooltip appears, NOT clipped. `/admin`
   settings → hover the **Holidays** tab → amber tooltip on hover. Confirm nav
   theme/language still work and the dark "+N more" tooltip is UNCHANGED.
2. **B — fullscreen exit:** `/lead/report?mode=slides` → enter fullscreen
   (toolbar toggle or press `f`) → a floating "Exit" pill (top-right) + a
   transient "Press Esc to exit" hint (top-center, ~3s) appear → both Esc and the
   pill exit → the toggle flips back to "Enter fullscreen" and regains focus.
   Repeat on the head deck (`/head` slides, `f` to enter; focus returns to the
   article). Verify pressing `f` toggles exactly once (no double-toggle).
3. **C — dense quadrant scroll** — the SCROLL GEOMETRY of the review-fix was
   already BROWSER-VERIFIED this session via a standalone Chromium repro of the
   exact structure (old vs new, sparse vs dense): NEW-sparse = zero scroll on
   both axes (watermark clipped); NEW-dense = inner container scrolls vertically
   306px (rows reachable, `h-full` resolves — no silent re-clip), zero horizontal
   scroll; the section is `overflow:hidden` so no phantom scrollbar (vs the OLD
   structure's measured 12px×12px). Residual full-app check: a real lead Summary
   slide with MANY records in one quadrant scrolls inside its equal zone; sparse
   quadrants fill; fullscreen works.
4. **D — capacity advisory:** admin → assign a 6th active product to a lead →
   "6 of 6 products" + a gentle over-cap note; Save still works. Lead section with
   > 5 records for ONE product → "N records may not fit cleanly on the slide"
   > advisory on that product's group; adding still allowed.
5. **E — product-grid alignment** — the SUBGRID band alignment was already
   BROWSER-VERIFIED this session via a standalone Chromium repro of 3 cards with
   uneven content: all four band tops (header / Current / Next / Risks+Decisions)
   land at the IDENTICAL Y across all three cards (17 / 67 / 132 / 182 px) — so
   subgrid aligns over the implicit auto-row tracks (no float). Residual full-app
   check: PRODUCT scope with ≥2–3 real products of different content volumes; an
   empty Risks+Decisions band still holds its place.

## Adversarial review — done (disposition below)

A multi-lens (5 Opus lenses) + Codex review ran over `git diff main...HEAD`
(Codex errored on a stream timeout; the lenses + an adversarial verify carried
it). 4 findings; disposition (commit `27d7d7c`):

- **1 MAJOR, confirmed in real Chromium → FIXED.** Change C: the card's
  `overflow-y-auto` turned the negative-offset corner watermark into a ~12px
  phantom scroll on BOTH axes on every card (incl. sparse), with a stray
  horizontal scrollbar (this was MY missed regression — I had dismissed the
  watermark earlier; the reviewer measured it). Fix: rows scroll in an inner
  container; the card frame stays `overflow-hidden` to clip the decorative
  watermark. Spec + test updated.
- **2 minor → FIXED.** D: group the decisions advisory by `productId` (match
  risks; skip unscoped) instead of the display string `productName`. B: keep the
  Esc-hint polite live region in the DOM and toggle only its text (reliable SR
  announce).
- **1 minor → DEFERRED to you (decision #3 below).**

The full gate was re-run GREEN after the fixes (typecheck / lint / test 1253 /
build 5/5).

## Two user decisions (still open — NOT blockers; both already coded as chosen)

1. **Capacity numbers** `MAX_PRODUCTS_PER_LEAD = 6`, `SLIDE_SECTION_SOFT_CAP = 5`
   in `@customreport/shared/src/constants.ts` — implemented as the user's stated
   values; tunable. Confirm or tweak.
2. **"+5 more" tooltip restyle** — still DEFERRED (out of change A per the repo
   "Visual And Theme Work" rule). The shared dark `TooltipContent` is UNTOUCHED.
   Pick a concrete surface to make it its own small change.
3. **A11y double-announce on the 5 button Coming-Soon controls** (review minor,
   NOT yet fixed). Radix auto-wires `aria-describedby` → the badge text "Coming
   Soon", while each control's `aria-label` ALSO ends with "is coming soon" — so
   a screen reader says "coming soon" twice. The deferred-feature-pattern design
   explicitly chose to keep the verbose `aria-label`, so reversing it (shorten
   the five labels to the bare feature name, letting the description carry
   "Coming Soon" once) is a YOUR-call decision + touches ~5 test assertions.
   Holidays is unaffected (its describedby sits on the inert span, not a focused
   button). Recommend: shorten the labels.

## Next steps

1. **Live-verify** per the steps above — the only outstanding proof, and the
   gate for archiving.
2. The five changes are still **ACTIVE (NOT archived)** — deliberately, because
   archive = "fully verified/done" and live-verify is the pending gap. Run
   `openspec archive <slug>` per change after live-verify (watch the
   exact-header / spec-debt gotchas; `--skip-specs` if archive spec-sync aborts).
3. **Merge** the branch to `main` (the agent does NOT push to the default
   branch). A draft PR may already be open — check GitHub.
4. Resolve the three open decisions.

## Gotchas carried this session

- `lead-slides-client.tsx` carries a recorded `/* eslint-disable max-lines */`
  (last-resort, reasoned) — its reusable control bits are already extracted to
  `deck-fullscreen-overlay.tsx`.
- Holidays a11y: the Radix tooltip badge is portaled (hover-only), so a
  PERSISTENT sr-only `<ComingSoonBadge>` keeps the tab accessible name announcing
  "Coming Soon" (the existing `settings-tab.test.tsx` accname test proves it).
- D surprise: only current/next-week `groupByProduct`; risks/decisions are flat —
  `firstOverCapRowIds` attaches the advisory once per over-cap group.
