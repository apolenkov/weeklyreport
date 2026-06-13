# Tasks — Pipeline State vs. Completeness (DESIGN draft)

CAPTURE DRAFT (2026-06-13 live walk). Do NOT implement before the design
questions in proposal.md are answered — this changes how lead read product
health, easy to get wrong.

## 1. Design (resolve first)

- [ ] 1.1 Define "my part complete" precisely (owned stages have status?
      required fields filled?). Write it down.
- [ ] 1.2 Pick the right-side affordance (dashed outline / check / progress).
      Screenshot a mock or describe exactly.
- [ ] 1.3 Confirm with `unify-risk-stage-status`: left-border severity source
      stays the risk model; this is presentation-only on top of it.

## 1b. Single source of truth (status derived from risks)

- [ ] 1.4 Make stage/product status a pure derivation of covering risks: adding
      a risk below reflects up immediately (chip + left edge + slide/preview),
      no manual sync. Reuse the `unify-risk-stage-status` coupling.
- [ ] 1.5 Severity priority blocker > at-risk > on-track when multiple risks
      cover one stage; show all risks, collapse status to the top severity.
- [ ] 1.6 Remove the now-obsolete "unbacked stage" warning (status can no longer
      be set without a backing risk). Update/remove its tests honestly.

## 2. Implement (after design sign-off)

- [ ] 2.1 Left border: ensure it reflects at-risk/blocked contributed by any
      stage owner, never green when a covering risk exists
      (`lead/sdlc-pipeline.tsx`). Reuse the existing risk-coverage predicate.
- [ ] 2.2 Right side: render the chosen completeness affordance, driven by the
      agreed completeness rule. Distinct from the health color.
- [ ] 2.3 Tests: health-vs-completeness are independent (red health + complete
      input; green health + incomplete input both render correctly), AND
      multi-risk priority (blocker wins over at-risk on one stage).

## 3. Gates

- [ ] 3.1 `pnpm typecheck && pnpm lint` + vitest for the touched web package.
- [ ] 3.2 Live re-check at `:3000`: a product with a stage-owner risk shows the
      severity on the left AND its own completeness on the right.
