# Tasks

- [x] 1. Spec delta for `lead-status-overview` (Active week after a failed save).
- [x] 2. RED test `lead-status-overview.week-after-failed-save.test.tsx`: after a failed save, an enabled "Next week" radio must apply the click or be disabled; fails today at the radio assertion.
- [ ] 3. Decide the behaviour: disabled while a submission exists (recommended) or re-target the retry to the new week.
- [ ] 4. Repair in `use-overview-item-editor.tsx` / `item-inline-editor.tsx` (separate grant and claim).
- [ ] 5. GREEN, six gates, independent review.
