# Handoff — lead-report feedback: IMPLEMENTED (2026-06-21, autonomous overnight)

## State in one line

All **five** OpenSpec lead-report-feedback changes are **implemented, gate-green,
and committed** on an isolated worktree branch. NOT pushed to `main`, NOT merged.
A clean **live-verify is blocked** by shared-environment contention (see below) —
the visual/geometry proofs are pending; everything else is green.

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

## ⚠ LIVE-VERIFY IS PENDING — this is the one real gap

jsdom cannot prove the VISUAL/geometry fixes (advisor flagged C/A/E as
browser-only). A clean live-verify was **blocked tonight**, NOT skipped:

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
3. **C — dense quadrant scroll:** a lead Summary slide with MANY records in one
   quadrant (>~6 rows) → that quadrant SCROLLS inside its equal framed zone (no
   clipped/lost rows); sparse quadrants still fill their zone; fullscreen still
   works. (jsdom proved the classes; only the browser proves the scroll geometry.)
4. **D — capacity advisory:** admin → assign a 6th active product to a lead →
   "6 of 6 products" + a gentle over-cap note; Save still works. Lead section with
   > 5 records for ONE product → "N records may not fit cleanly on the slide"
   > advisory on that product's group; adding still allowed.
5. **E — product-grid alignment:** `/lead/report?mode=slides`, PRODUCT scope,
   ≥2–3 products of different content volumes → the Current / Next /
   Risks+Decisions bands line up horizontally across cards (nothing floats); an
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
