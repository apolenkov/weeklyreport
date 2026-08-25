## 1. Web Fill From Geometry

- [x] 1.1 Apply the mobile 44 px minimum width and height to both actionable Fill From split-button segments while preserving compact desktop geometry.
- [x] 1.2 Add a focused component regression test for both mobile target dimensions and the desktop toolbar token.

## 2. Product Evidence and Verification

- [ ] 2.1 Re-run the source-bound iPhone 14 and Pixel 7 browser assertion, measure both Fill From actions at 44 px or larger, and capture the repaired lead form without horizontal overflow.
- [ ] 2.2 Run `pnpm --filter @customreport/web exec vitest run src/features/period/ui/fill-from-button.test.tsx`, `pnpm --filter @customreport/web typecheck`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format:check`, and `openspec validate fix-mobile-fill-touch-targets --strict`.
