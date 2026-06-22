# Handoff — lead-report live feedback (2026-06-20, autonomous grill)

Status: Act-1 grill + Act-2 Codex review **complete (converged, final arbiter)**;
four OpenSpec changes authored, validated `--strict`, and Codex-reviewed over 3
rounds. **No code written** — the grill-with-docs-codex skill stops at approved
changes. **Not pushed / not committed** (awaiting the user).

Review: 3 Codex rounds via the `codex:codex-rescue` runtime (R1: 10 substantive;
R2: 1 factual error + nits; R3: 2 mechanism clarifications + nits — all applied),
then Codex hit its usage limit (round 4 blocked). As a Codex-round-4 SUBSTITUTE,
a 6-agent independent verification pass (read against the real code) ran and
caught issues 3 Codex rounds missed — most importantly a BLOCKING OpenSpec defect
in change A (a RENAMED MODIFIED header that archive/sync would not apply). All
findings applied; all four re-validated `--strict`. No Codex `VERDICT: APPROVED`
line exists (quota), so convergence is the final-arbiter judgment. See each
change's `PLAN-REVIEW-LOG.md` (Rounds 1–5).

## Update 2026-06-21 (user back; two decisions made; 5th change added)

- **Q1 — C overflow direction: KEEP SCROLL ONLY.** The user chose the scroll
  baseline; the "fit on one screen / split into 2 slides" is NOT pursued (it would
  reverse the 2026-06-10 sign-off). `fix-lead-slide-quadrant-overflow` stands as
  the final answer for theme C overflow; `add-slide-capacity-signals`' advisory is
  now firmly the "weak under scroll" wording (no split branch).
- **Q2 — the "не летало" gap: AUTHORED a 5th change.** The user confirmed the
  complaint is the PRODUCT grid → new change `fix-lead-product-grid-card-alignment`
  (subgrid shared row tracks; always render four bands; drop `mt-auto`). Codex
  reviewed it (quota restored) → PASS.
- **Final Codex confirmation (2026-06-21):** `add-slide-capacity-signals` and the
  5th change got explicit PASS. Codex graded A/B/C1 as "FAIL" only because the
  CODE/durable spec do not yet reflect them — the expected state of an un-applied
  OpenSpec change (tasks `[ ]`; the skill stops before implementation). The delta
  artifacts are correct (REMOVED+ADDED, hook ownership, floor-on-track,
  per-product advisory). One residual contradictory "max-height" heading in C1
  was fixed. Final-arbiter: the five PLANS are sound and ready to implement.

There are now **FIVE** active changes (the four below + `fix-lead-product-grid-card-alignment`).

## Origin

Three batches of live page feedback on `/lead/report/...` and `?mode=slides`
(2026-06-20). The user authorized an autonomous grill and left. Decisions were
made autonomously from codebase exploration + best-practices research + an
`advisor` blind-spot pass + a Codex adversarial review loop.

## The four changes (all in `openspec/changes/`, active)

1. **`fix-coming-soon-tooltip-clipping`** (Theme A)
   - The Agent-review (toolbar) and admin Holidays (TabsList) Coming-Soon
     controls show NO tooltip — the amber badge is clipped by an
     `overflow-x-auto` ancestor, and the prior change removed the native-title
     fallback. Migrate all six tooltip-anchored Coming-Soon controls to the
     Radix Tooltip (portal escapes the clip); keep the canonical amber badge;
     restyle the shared `TooltipContent` softer (the "+N more" "white-on-black"
     ask). MODIFIES `deferred-feature-pattern` + `admin-settings-ui`.
2. **`add-slide-fullscreen-exit-affordance`** (Theme B)
   - Lead got stuck in slides fullscreen. Add the floating exit pill to the lead
     deck + a transient "Press Esc to exit" hint + `aria-pressed` + focus return.
     Hoist the `f` shortcut + `fullscreenchange` into one deck-level
     `useFullscreen` hook (button becomes presentational). MODIFIES
     `status-slide-rendering`.
3. **`fix-lead-slide-quadrant-overflow`** (Theme C, runtime)
   - Dense Summary quadrants clip rows (`overflow-hidden`, no scroll) — data
     loss, and a violation of the slide specs. Baseline fix: `overflow-y:auto`
     - `min-h-0` so each quadrant scrolls within its equal `auto-rows-fr` row.
       MODIFIES `lead-slide-quadrants`.
4. **`add-slide-capacity-signals`** (Theme C, authoring)
   - Advisory-only signals: `MAX_PRODUCTS_PER_LEAD = 6` shown in admin product
     assignment; a "may not fit the slide" advisory when a section exceeds
     `SLIDE_SECTION_SOFT_CAP = 5`. No enforcement (no schema/Zod/server). ADDS
     `slide-capacity-signals`.

## Decisions to foreground for the user (these are his calls)

1. **C overflow direction (highest-judgment).** `fix-lead-slide-quadrant-overflow`
   only stops the data loss (scroll). It does NOT deliver the "fit on one screen"
   or "split into 2 slides" the user asked for — those reverse the 2026-06-10
   user-signed-off equal-quadrant, fixed-aspect design. Options (scroll baseline
   / taller-frame / continuation slides) are laid out in that change's
   `design.md`. **He must pick** before the fit/split work is specced. This
   choice also gates `add-slide-capacity-signals`: its "section may not fit the
   slide" advisory copy is weak under scroll and outright wrong under a
   continuation-slide choice (it fits on the next slide) — implement C2's section
   warning AFTER this is locked.
2. **The "6" products / "5" section caps** (`add-slide-capacity-signals`) are the
   user's approximate numbers, recorded as tunable constants, advisory only.
   Confirm the numbers and whether he ever wants a HARD cap (currently no).
3. **The "+5 more" tooltip restyle** — PULLED OUT of `fix-coming-soon-tooltip-clipping`.
   The repo "Visual And Theme Work" rule makes a surface restyle research-only
   until the user picks a concrete direction, and the shared `TooltipContent` is
   also used by the SDLC stage chips and the sidebar (broad blast radius). Pick a
   concrete surface (e.g. light card token + border + soft shadow) and it becomes
   its own small change. Change A now leaves the shared dark tooltip untouched.
4. **Per-product slide grid alignment ("блоки на одном уровне, чтобы не летало")**
   — POSSIBLE uncovered gap / new change. The completeness critic reads this
   feedback item as the per-product grid (`lead-product-grid.tsx`), which floats:
   the grid has no shared row track and `mt-auto` pushes each card's
   Risks/Decisions to the bottom, so blocks start at different Y across cards. The
   Summary view is already level (`auto-rows-fr`). If he meant the product grid, it
   needs a NEW small change (shared row track / drop `mt-auto`); if he meant
   Summary, it is already fine. Confirm the surface before authoring.

## Honest note on "tooltip через один инструмент?"

No — there are THREE hover systems (now in `CONTEXT.md`): the shared Radix
tooltip (+N more, stage chips, sidebar, and — after change A — Coming-Soon), the
separate `sdlc-tooltip.tsx` `createPortal` (stage-chip, different problem, OUT of
scope), and the retired Coming-Soon CSS overlay. After change A: Coming-Soon
joins the Radix one; the `sdlc-tooltip` portal stays separate.

## Process notes

- CONTEXT.md glossary updated: "Tooltip / hover affordance" (three systems) +
  "Slide capacity (soft cap)".
- `advisor` served as the Act-1 cross-model blind-spot pass; its key correction
  (do not autonomously reverse the signed-off C design) is applied.
- Act-2 Codex ran via the `codex:codex-rescue` runtime — bare `codex exec` hung
  on quota (doctor healthy, no stream); the runtime route worked. Logged per
  change in `PLAN-REVIEW-LOG.md`.

## Next steps (user)

1. Resolve the three decisions above (esp. #1).
2. Implement per each change's `tasks.md` (apply flow), then gate:
   `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
3. Live-verify, then `openspec archive <name>` per change on merge.
