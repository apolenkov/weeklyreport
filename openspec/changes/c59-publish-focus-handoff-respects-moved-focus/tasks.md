# Tasks

## 1. Contract and RED

- [x] 1.1 Requirement and scenarios (C4678).
- [x] 1.2 RED in `publish-lock-button.test.tsx`: focus moved after a confirmed publish and after a confirmed reopen is kept when the status flips. Controls: the existing hand-off, fallback and no-steal tests.
- [x] 1.3 Run the file on the base: exactly two failing tests, every other test passing.

## 2. Repair

- [x] 2.1 `publish-lock-button.tsx`: both hand-offs move focus only when `document.activeElement` is the body or null.

## 3. Verification

- [ ] 3.1 Full gates, independent review.
- [ ] 3.2 Native: publish with a slow refetch while moving focus.
