# Tasks

## 1. Specification

- [x] 1.1 Validate with `pnpm exec openspec validate w503-r3-ifrole-loading-indicator --strict`.

## 2. Web

- [x] 2.1 RED: `if-role.test.tsx` expects `loadingFallback` while pending and nothing extra when loaded or errored; `alert-bar.test.tsx` expects the placeholder then the link.
- [x] 2.2 GREEN: `loadingFallback` prop in `IfRole`; pass the placeholder in `ConfigureRemindersLink`.

## 3. Verification

- [x] 3.1 Focused vitest, prettier, eslint and web typecheck.
