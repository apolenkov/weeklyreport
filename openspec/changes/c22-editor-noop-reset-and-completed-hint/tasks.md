# Tasks

## 1. Contract and RED

- [x] 1.1 RED in `status-overview-activity-editor.test.tsx`: Reset on an empty title keeps the draft clean (no pending report, Save disabled, no unload prevention); control: Reset after a description edit stays pending.
- [x] 1.2 RED in `item-inline-editor.test.tsx`: the existing basic-editor fallback test also asserts the completed-plan reason beside the routing hint, focus and kept draft.
- [x] 1.3 Run both files on the base (web unit, 1 worker): exactly one failing test in each file (C5076 Reset test; the extended fallback test), every other test passing (17 and 20).

## 2. Repair (separate GO)

- [x] 2.1 `reset` returns early on an exact `title === ""` check (no `normalize()`), otherwise sets the title to empty and marks the draft pending.
- [x] 2.2 Render `form.nextStepTextError` inside the existing `#item-next-step` paragraph before the routing hint: one `role="alert"` element, `tabIndex={-1}` kept (`lead-status-overview.test.tsx` uses `findByRole("alert")`).

## 3. Verification

- [ ] 3.1 Run pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm spec:check on the reviewed tree; independent review.
- [ ] 3.2 Optional native observation (separate window): focus target and speech of the basic editor alert, and the leave-page prompt after Reset.
