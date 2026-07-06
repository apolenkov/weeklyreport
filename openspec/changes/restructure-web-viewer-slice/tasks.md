## 1. Relocate the viewer report shell into a new viewer slice (behavior-neutral)

- [x] 1.1 `git mv` `components/viewer/viewer-report-shell.tsx` + its test to the
      new `features/viewer/ui/`; remove the emptied `components/viewer/`.
- [x] 1.2 Rewrite the moved files' relative imports to the new depths; fix the
      test's self-import to `./viewer-report-shell`.
- [x] 1.3 Reroute the two `app/(app)/reports/[reportId]/` consumers (page + test);
      grep `components/viewer` repo-wide = 0.

## 2. Verify (behavior-neutral)

- [x] 2.1 Cold `tsc --noEmit` 0 errors.
- [x] 2.2 Focused eslint `--max-warnings 0` clean.
- [x] 2.3 Full web unit suite 1567 passing.
- [x] 2.4 `openspec validate restructure-web-viewer-slice --strict` green.
