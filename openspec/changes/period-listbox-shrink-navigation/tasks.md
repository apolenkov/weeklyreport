## 1. Web navigation correction

- [x] 1.1 Add public PeriodNavigator regressions for three-to-two and four-to-two option shrink, one ArrowUp, focus/scroll/active-descendant agreement and Enter/Space navigation; observe four intended failures on the pre-fix owner.
- [x] 1.2 Correct the ArrowUp state transition and pass the full PeriodNavigator plus reminders and head-history suites with the existing immediate-selection/empty-list controls retained.
- [x] 1.3 Sync the complete dialog-listbox-a11y requirement and new continuation scenario; validate this change and record the synchronized-spec proof.

## 2. Branch verification

- [ ] 2.1 Run pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm spec:check; record exact SHA, commands, exit codes, cache scope and skipped browser tests.

After all tracked tasks pass, archive this change, preserve its full artifacts outside the repository and remove only its generated archive directory as required by AGENTS.md.
