# Tasks

## 1. Contract and RED

- [x] 1.1 Requirement and scenarios (C5189).
- [x] 1.2 RED in `status-slide-deck.test.tsx`: modified ArrowRight/ArrowLeft emit no index and stay unprevented; controls are the existing plain-arrow paging, browser-default and editor-input tests.
- [x] 1.3 Run the file on the base: the four new modified-arrow cases fail, every other test passes.

## 2. Repair

- [x] 2.1 `status-slide-deck.tsx`: return early from the paging handler when Ctrl, Meta, Alt or Shift is held.

## 3. Verification

- [ ] 3.1 Full gates on the reviewed tree (`pnpm check:push`, `pnpm build`) and independent review; owned by the parent integration.
- [ ] 3.2 Native: browser/AT behavior of modified arrows on the public deck.
