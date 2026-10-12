# Tasks

- [x] 1. Spec delta for `authenticated-product-feedback`.
- [x] 2. `FeedbackLimitError`, 409 mapping, shared `assertThreadHasRoom`.
- [x] 3. Unit tests: 49 rejects before persistence, 48 accepts, dismissal at 49 accepted and at 50 rejected, handler 409.
- [ ] 4. Native check: read-only count of annotations with thread messages >= 49 on the guarded targets (legacy rows decide whether a grandfather policy is needed).
- [ ] 5. Native check: guarded API integration - 50th reply returns 409 with no thread_message or agentation_event row; dismissal at 49 succeeds; concurrent reply and dismiss at the boundary.
- [ ] 6. Native check: agent-browser shows a readable error on 409 for reply and dismiss in the stock widget and the /feedback inbox.
