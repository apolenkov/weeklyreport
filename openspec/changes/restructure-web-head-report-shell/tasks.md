## 1. Relocate the head report shell (behavior-neutral)

- [x] 1.1 `git mv` `components/head/head-report-shell.tsx` + `head-report-shell.test.tsx`
      to `features/report-sections/ui/`; remove the emptied `components/head/`.
- [x] 1.2 Rewrite the moved files' relative imports to the new depths (same-slice
      `../model/*`, sibling-slice `../../period/ui/*`, legacy `../../../components/*`);
      fix the test's self-import to `./head-report-shell`.
- [x] 1.3 Reroute the two `app/(app)/head/report/[reportId]/` consumers (page + test);
      grep `components/head` repo-wide = 0.

## 2. Verify (behavior-neutral)

- [x] 2.1 Cold `tsc --noEmit` 0 errors.
- [x] 2.2 Focused eslint `--max-warnings 0` clean (no exemption needed).
- [x] 2.3 Full web unit suite 1567 passing. The head report route was live-verified
      200 during the lead dissolve.
- [x] 2.4 `openspec validate restructure-web-head-report-shell --strict` green.
