## 1. Relocate the root primitives + components/ui to shared (behavior-neutral)

- [x] 1.1 `git mv` the loose root primitives (`error-boundary`, `forbidden-page` + test + snapshot, `role-gate` + test, `agentation-devtools`,
      `coming-soon-style.test`) and `components/ui/*` (`confirmation-dialog` + test,
      `sdlc-tooltip`) to `shared/ui/`; `web-vitals-reporter` to a new
      `features/telemetry/ui/`. Remove the emptied `components/ui/` and
      `components/__snapshots__/`.
- [x] 1.2 Reroute all consumers (root/segment layouts, feature slices) and the two
      deferred-`slides/` files importing `sdlc-tooltip` via `../ui/` (owner-approved).
- [x] 1.3 Fix `coming-soon-style.test.tsx` path anchors for the +1 depth
      (`components/` → `shared/ui/`): `repoRoot` and the control-file joins.

## 2. Verify (behavior-neutral)

- [x] 2.1 Cold `tsc --noEmit` 0 errors.
- [x] 2.2 Full web eslint `--max-warnings 0` clean (no exemption needed).
- [x] 2.3 Full web unit suite 1567 passing (incl. the re-anchored source scan).
- [x] 2.4 Live-verify from source (`:3102`): `/` (root layout with the moved
      web-vitals-reporter + role-gate), `/reports`, `/head/report/[id]` all HTTP
      200, no module-resolution 500.
- [x] 2.5 `openspec validate restructure-web-shared-primitives --strict` green.
