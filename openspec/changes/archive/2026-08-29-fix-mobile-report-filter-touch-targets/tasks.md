## 1. Web Ownership-Filter Geometry

- [x] 1.1 Apply the 44 px mobile minimum width and height to every ownership-filter option while preserving compact desktop geometry and behavior.
- [x] 1.2 Add focused component tests for responsive geometry, accessible names, and selected state.

## 2. Product Evidence and Verification

- [x] 2.1 Re-run the source-bound iPhone 14 and Pixel 7 assertion and measure every ownership-filter option at 44 px or larger without horizontal overflow.
- [x] 2.2 Run the focused filter tests, `pnpm --filter @customreport/web typecheck`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format:check`, and `openspec validate fix-mobile-report-filter-touch-targets --strict`.
