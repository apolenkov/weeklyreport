# Tasks

## 1. Contract and RED

- [x] 1.1 Requirement and scenarios (C5096, C5097).
- [x] 1.2 RED in `record-comments.test.tsx`: delete feedback beside a draft error; the hint beside a separate alert. Control: valid draft with feedback.
- [x] 1.3 Run the file on the base (web unit, 1 worker): exactly two failing tests (the two RED), 34 others passing.

## 2. Repair

- [x] 2.1 `record-comment-composer.tsx`: `aria-describedby` keeps the validation id and the feedback id together.
- [x] 2.2 Render the hint always; render the validation error as its own `role="alert"` paragraph with the validation id.

## 3. Verification

- [ ] 3.1 Full gates, independent review.
- [ ] 3.2 Native: announcement of the validation alert and of delete feedback (browser/AT); stale delete dialog reachability (C5108/C5109).
