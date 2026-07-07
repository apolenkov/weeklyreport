## Why

Parent `restructure-directory-architecture` task 3.1. `components/slides/` was the
LAST tree under `apps/web/src/components/`; every other domain has graduated to
`features/`. This change relocates the status-slide presentation deck into its own
`features/slides` slice and removes the now-empty `components/` root entirely.

## What Changes

- Relocate all 22 slide files (+ tests + the one snapshot) from `components/slides/`
  into a new `features/slides` slice, split ui/model:
  - `features/slides/model/` — the pure grid/util `.ts` files: `slide-grid-cells`,
    `slide-grid-foreign`, `slide-grid-model`, `slide-grid-rows`,
    `section-slide-utils`, `lead-slide-periods`, `lead-slides-deck-model` (`.tsx`
    but pure — no JSX; it builds the deck view-model).
  - `features/slides/ui/` — the rendering `.tsx` components (carousel, articles,
    pills, badges, skeleton, clients, decks) + `slide-skeleton`'s snapshot.
- Reroute imports src-relative: the slice's own relative imports (incl. the
  ui→model refs and the `slides → report-sections/model` cross-slice edges) and the
  external consumers (report-sections' head-report-shell + lead-form, viewer's
  report shell). Rewrite covered BOTH `from "…"` and `vi.mock/importActual` string
  literals (a mock pointing at a moved path silently unmocks — tsc/lint blind).
- Register the slice: add `slides` to `webSlices`; grandfather its only outbound
  edge (`slides → report-sections`) and the two inbound edges
  (`report-sections → slides`, `viewer → slides`). Repoint the 6 `eslint.config.ts`
  max-lines/complexity exemptions from `components/slides/*` to
  `features/slides/{ui,model}/*`.
- Remove the emptied `components/slides/` and the `components/` root.
- **Behavior-neutral**: pure relocation + import reroute. Two archaeology comments
  on moved files scrubbed (`section-slide-utils` non-null-assertion justification,
  `slide-grid-foreign` design-doc ref) per the comment-hygiene standard.

## Non-goals

- No slide logic change. No enforcement flip beyond registering `slides` itself.
  The slice keeps its pre-existing `slides → report-sections` coupling (grandfathered).

## Impact

- Affected: 22 relocated files (+ tests + 1 snapshot) under `features/slides/{ui,model}`;
  ~6 rerouted external consumer imports; `eslint.config.ts` (`webSlices` + 3
  grandfather entries + 6 repointed exemptions). `components/` deleted.
- Parent: `restructure-directory-architecture` task 3.1 — this completes the web
  relocation; nothing remains under `components/`.
- No load-bearing invariant touched.
- Verified: `pnpm typecheck` 5/5, full `pnpm lint` clean, unit suite green
  (web 1567 + api + shared), live-verified from source on `:3100` —
  `/lead/report/[id]/preview` 200 (lead deck) and `/head/report/[id]/present` →
  `?mode=slides` 200 (head deck), zero module-resolution 500. Adversarial review
  (deep-reasoner) CLEAN on vi.mock resolution, ui/model split, boundary
  completeness, snapshot, and no lingering `components/slides` refs.
