# Tasks — Pipeline State vs. Completeness (DESIGN draft)

Design questions resolved 2026-06-13/14 — see `design.md` (D1–D3).
Implementation is now unblocked. Regression-heavy: this changes how leads read
product health; read existing sync/status tests before changing semantics.

## 1. Design (resolve first)

- [x] 1.1 "My part complete" = every stage the lead OWNS for the product has an
      explicit status set (on-track/at-risk/blocked); per product. See D1.
- [x] 1.2 Affordance = dashed/dotted outline ring while incomplete + a small
      `N/M stages` counter pill; never the health hue. See D2.
- [x] 1.3 Confirmed: left-border severity source stays the `unify-risk-stage-status`
      risk model; this change is presentation + status-derivation on top. See D3.

## 1b. Single source of truth (status derived from risks)

- [x] 1.4 Make stage/product status a pure derivation of covering risks: adding
      a risk below reflects up immediately (chip + left edge + slide/preview),
      no manual sync. Reuse the `unify-risk-stage-status` coupling.
- [x] 1.5 Severity priority blocker > at-risk > on-track when multiple risks
      cover one stage; show all risks, collapse status to the top severity.
- [x] 1.6 Remove the now-obsolete "unbacked stage" warning (status can no longer
      be set without a backing risk). Update/remove its tests honestly.

## 2. Implement (after design sign-off)

- [x] 2.1 Left border: ensure it reflects at-risk/blocked contributed by any
      stage owner, never green when a covering risk exists
      (`lead/sdlc-pipeline.tsx`). Reuse the existing risk-coverage predicate.
- [x] 2.2 Right side: render the chosen completeness affordance, driven by the
      agreed completeness rule. Distinct from the health color.
- [x] 2.3 Tests: health-vs-completeness are independent (red health + complete
      input; green health + incomplete input both render correctly), AND
      multi-risk priority (blocker wins over at-risk on one stage).

## 3. Gates

- [x] 3.1 `pnpm typecheck && pnpm lint` + vitest for the touched web package.
- [x] 3.2 Live re-check at `:3000`: a product with a stage-owner risk shows the
      severity on the left AND its own completeness on the right.
      FINAL VERDICT (2026-06-14 live walk): the completeness counter inflated on
      reload — a covering risk floored the lead's UNTOUCHED stages, so the read
      model (`lead-form.ts buildStageGrid`) returned a risk-derived severity for
      stages the lead never set, and `computeCompleteness` counted them as
      "filled" (0/3 -> 3/3, surviving reload). Root cause: the read model applied
      the severity floor to EMPTY owned stages too. Fix: `buildStageGrid` now
      keeps an untouched (empty) owned stage `empty`; the floor for DISPLAY is
      re-applied at render by `applyRiskSeverityFloor` (live) /
      `floorSlideStageStatus` (slides). Touched stages still floor-up /
      collapse-down via `deriveEffectiveStageStatus`. Live-verified: one
      at-risk risk over 3 untouched owned stages floors the chips to at-risk for
      display, the pill stays 0/3, and it stays 0/3 after reload. New regression
      test in `lead-form.test.ts` ("an UNTOUCHED owned stage covered by a risk
      stays empty"); web suite 1104/1104, typecheck + lint clean.
