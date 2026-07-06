## Why

Parent `restructure-directory-architecture` task 3.1 — the final relocation that
empties the flat `components/` tree of everything but the deferred `slides/`.
`components/dev/role-switcher.tsx` is the dev-only role/session switcher.

**Domain decision (layering-forced, not arbitrary):** the mapping flagged this
file as `auth`-domain but noted it could instead be judged business-agnostic dev
tooling for `shared/`. Its consumer `shared/ui/navigation/nav-bar.tsx` is in the
`shared/` layer, and `shared/` MUST NOT depend on a `features/` slice. Placing
role-switcher in `features/auth/ui/` would create a forbidden `shared → features`
backward import; `shared/ui/` is therefore the only lawful home. (It is also a
≥2-slice consumer helper — nav-bar, the login page, lead-form, hooks — so rule-of-2
independently points to `shared/`.)

## What Changes

- Relocate `components/dev/role-switcher.tsx` (+ co-located test) to `shared/ui/`,
  filename unchanged (same directory depth, so its own imports are unchanged).
- Reroute the consumer `shared/ui/navigation/nav-bar.tsx` to `../role-switcher`.
- Remove the emptied `components/dev/` directory. `components/` now holds only the
  deferred `slides/` tree.
- **Behavior-neutral**: pure relocation + import reroute.

## Non-goals

- No component change. No move of `slides/` (deferred). No `webSlices`/zone-5
  change (shared/ has no cross-slice edge to enforce).

## Impact

- Affected code: `shared/ui/role-switcher.{tsx,test.tsx}` (new), the deleted
  `components/dev/` tree, one rerouted consumer import.
- Parent: `restructure-directory-architecture` task 3.1. Mapping:
  `docs/architecture/mapping/missing-singles-2026-07-02.md`.
- No load-bearing invariant touched (dev-only affordance behind
  `NEXT_PUBLIC_DEV_ROLE_SWITCHER`).
- Verified: cold `tsc` 0, full web eslint clean, full web suite 1567.

## Note — web relocation status after this change

`components/` retains only the deferred `slides/` tree; every other web domain now
lives under `features/` or `shared/`. The remaining restructure work is
`lib/mappers/` dissolution into each slice's `model/`, the web-boundaries
enforcement flip (adding the populated slices to the zone-5 allowlist), and the
api slices (4–6).
