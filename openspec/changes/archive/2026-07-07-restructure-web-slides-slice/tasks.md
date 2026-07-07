## 1. Relocate components/slides into features/slides (behavior-neutral)

- [x] 1.1 `git mv` the 22 slide files (+ tests + `slide-skeleton.test.tsx.snap`)
      into `features/slides/model` (pure `.ts` grid/util files +
      `lead-slides-deck-model.tsx`) and `features/slides/ui` (`.tsx` components);
      remove the emptied `components/slides/` and the `components/` root.
- [x] 1.2 Reroute imports src-relative — the slice's own relative refs (ui→model,
      `slides → report-sections/model`) and the external consumers
      (report-sections head-report-shell + lead-form, viewer report shell).
      Rewrite BOTH `from "…"` and `vi.mock/importActual` string literals.
- [x] 1.3 Register the slice in `eslint.config.ts`: add `slides` to `webSlices`;
      grandfather `slides → report-sections`, `report-sections → slides`,
      `viewer → slides`; repoint the 6 max-lines/complexity exemptions to the new
      `features/slides/{ui,model}` paths.
- [x] 1.4 Scrub the 2 archaeology comments on moved files
      (`section-slide-utils`, `slide-grid-foreign`).

## 2. Verify (behavior-neutral)

- [x] 2.1 Cold `tsc --noEmit` 0 errors (`pnpm typecheck` 5/5).
- [x] 2.2 Full `pnpm lint` clean — slides boundary complete (all in/out edges
      grandfathered), exemptions resolve at their new paths.
- [x] 2.3 Full unit suite green (web 1567 + api + shared).
- [x] 2.4 Live-verify from source (`:3100`): `/lead/report/[id]/preview` 200
      (lead deck), `/head/report/[id]/present` → `?mode=slides` 200 (head deck) —
      no module-resolution 500.
- [x] 2.5 Adversarial review (deep-reasoner) CLEAN; `openspec validate
restructure-web-slides-slice --strict` green.
