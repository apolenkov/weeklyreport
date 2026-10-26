# Tasks

## 1. Contract and RED

- [x] 1.1 Requirement and scenarios (C5298).
- [x] 1.2 RED in `sdlc-tooltip.test.tsx`: the hovered lock badge unmounts. Control: an unrelated badge unmounts.
- [x] 1.3 Run the file on the base: C5298, stale-owner mouseleave and StrictMode removal fail; the other provider tests pass.

## 2. Repair

- [x] 2.1 Implement the shared identity-scoped hook cleanup designed in `c73`; verify that an old owner's unmount and mouseleave preserve a newer owner's tooltip.

## 3. Verification

- [x] 3.1 Focused consumer/provider tests, changed-source ESLint, web typecheck and strict change validation.
- [ ] 3.2 Parent integration: full gates and independent review.
- [ ] 3.3 Native: actual list removal/next-anchor ownership, C5262 frame capture, C5264 layout shift, C5255 open popup, C5370 arrow boxes.
