# Tasks

## 1. Specification

- [x] 1.1 Validate with `pnpm exec openspec validate w503-r3-plan-details-stay-open --strict`.

## 2. Web

- [x] 2.1 RED: `overview-plan-composer.test.tsx` expects the "Parent and stages" section to stay open after a Parent is chosen, and to stay collapsed after a manual collapse and a Parent change.
- [x] 2.2 GREEN: `OutcomeDetails` keeps `open` in `useState`, initialised from the unresolved parent and updated from `toggle`.

## 3. Verification

- [x] 3.1 Focused vitest, prettier, eslint and web typecheck.
