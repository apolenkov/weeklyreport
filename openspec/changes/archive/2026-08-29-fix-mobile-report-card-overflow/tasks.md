## 1. Web Item-Card Layout

- [x] 1.1 Reflow mobile item-card metadata and actions within the board width while preserving every 44 px action target and the desktop layout.
- [x] 1.2 Add focused component tests for the responsive fit contract, visible actions, and unchanged accessible labels.

## 2. Product Evidence and Verification

- [x] 2.1 Extend the source-bound mobile assertion to reject nested current-week and next-week board overflow and non-zero horizontal offsets after dialog open and close.
- [x] 2.2 Capture and review the repaired iPhone 14 and Pixel 7 forms with complete card content and no hidden item actions.
- [x] 2.3 Run the focused item-card tests, `pnpm --filter @customreport/web typecheck`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format:check`, and `openspec validate fix-mobile-report-card-overflow --strict`.
