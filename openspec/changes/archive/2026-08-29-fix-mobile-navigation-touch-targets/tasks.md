## 1. Shared UI Geometry

- [x] 1.1 Make the shared Coming Soon navigation icon shape use the responsive toolbar height and mobile minimum width, then update its focused primitive test.

## 2. Web Navigation Geometry

- [x] 2.1 Apply the same responsive height and minimum-width contract to Sign out and the right-rail loading skeleton.
- [x] 2.2 Add focused web tests that pin control and skeleton parity while preserving labels, order, and behavior.

## 3. Product Evidence and Verification

- [x] 3.1 Re-run the source-bound 390 px browser assertion and capture the repaired Theme, Language, and Sign out targets without horizontal overflow.
- [x] 3.2 Run `pnpm --filter @customreport/web exec vitest run src/shared/ui/coming-soon-style.test.tsx src/shared/ui/navigation/nav-logout-button.test.tsx src/shared/ui/navigation/nav-bar.test.tsx`, the relevant UI package typecheck/test command, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format:check`, and `pnpm exec openspec validate fix-mobile-navigation-touch-targets --strict`.
