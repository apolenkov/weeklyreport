# Tasks

Backlog: TASK-825.

- [x] 1. Failing test first: creating an item with plain "Save update" in a unit with several Current rows puts focus on the new item's control, not on a control of the next unit.
- [x] 2. Fallback tests: when the new item's control is absent, focus returns to the opener, then the Overview heading — never to another unit's Add (that case failed before the Astra-review fix).
- [x] 3. Implement: on an acknowledged plain create save, focus the new item by identity (`stableId ?? id`) after the dialog closes; keep cancel, edit and "Save and add another" focus unchanged.
- [x] 4. Existing overview editor/focus tests stay green.
- [ ] 5. Six gates on the delivered tree; browser check with agent-browser on the lane A stand (long product: new row visible after save).
- [ ] 6. Astra acceptance; push to main; archive the change after acceptance.
