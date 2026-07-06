## 1. Relocate the dev role-switcher to shared (behavior-neutral)

- [x] 1.1 `git mv` `components/dev/role-switcher.tsx` + its test to `shared/ui/`
      (same depth, so its own imports are unchanged); remove the emptied
      `components/dev/`.
- [x] 1.2 Reroute the `shared/ui/navigation/nav-bar.tsx` consumer to
      `../role-switcher`; grep `components/dev` repo-wide = 0.

## 2. Verify (behavior-neutral)

- [x] 2.1 Cold `tsc --noEmit` 0 errors.
- [x] 2.2 Full web eslint `--max-warnings 0` clean.
- [x] 2.3 Full web unit suite 1567 passing.
- [x] 2.4 `openspec validate restructure-web-dev-role-switcher --strict` green.
