# Tasks

- [x] 1. Spec delta for `authenticated-product-feedback` (008: option A, L = 1 MiB).
- [x] 2. RED integration test `agentation-action-size.integration.test.ts`: a session built through the public ingress at maximum field sizes serializes above 1 MiB; `action()` must throw `FeedbackLimitError` and write no `action.requested` event; control below the limit emits one event.
- [x] 3. Run RED on a guarded lane (Root window R2: action resolved 5, control passed).
- [x] 4. Repair: `action()` calls `assertActionEventFits` (`agentation.repository.helpers.ts`) before `emit`; above 1 MiB it throws `FeedbackLimitError`.
- [ ] 5. GREEN on the same lane, six gates, independent review.

The existing 409 body names the thread limit (`thread_limit_reached`); whether
the action refusal needs its own error code is decided before the repair.
