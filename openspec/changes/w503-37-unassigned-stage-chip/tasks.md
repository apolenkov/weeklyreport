# Tasks

## 1. Contract and RED

- [x] 1.1 Requirement and scenarios for a saved stage outside the available
      list (C5035).
- [x] 1.2 RED in `stage-multi-select.test.tsx`: chip shown, removal drops only
      that name, an untouched saved name survives a toggle.
- [x] 1.3 Run the file before the fix: only the new assertions failed
      (5 failed, 11 passed).

## 2. Implementation (web)

- [x] 2.1 `stage-multi-select.tsx`: removable `<name> — no longer assigned`
      chips, kept out of the checkbox set and the severity preview.
- [x] 2.2 `onChange` payload keeps the saved order and drops only the names the
      lead unchecked or removed.

## 3. Verification

- [x] 3.1 Focused vitest (16/16 plus 180 consumer tests), the full web unit
      suite (4592 tests), focused ESLint and Prettier, and
      `pnpm --filter @weeklyreport/web typecheck`.
- [x] 3.2 `pnpm spec:check` (`openspec validate --all --strict`).
- [ ] 3.3 Full gates and independent review on the reviewed tree.
