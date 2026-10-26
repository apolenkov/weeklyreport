# Tasks

## 1. Contract and RED

- [x] 1.1 Requirement and scenarios (C5180).
- [x] 1.2 RED in `slide-article-rows.test.tsx`: the hovered row leaves the list. Control: an unrelated anchor unmounts.
- [x] 1.3 Run the file on the base: C5180 fails, every other test in the file passes.

## 2. Repair

- [x] 2.1 Give each shared hook instance a stable ownership identity; provider cleanup and mouseleave clear only that owner's visible tooltip (shared with C5298).

## 3. Verification

- [x] 3.1 Focused consumer/provider tests, changed-source ESLint, web typecheck and strict change validation.
- [ ] 3.2 Parent integration: full gates and independent review.
- [ ] 3.3 Native: stale tooltip after a real refetch or edit; C5159 carousel trace.
