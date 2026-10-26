# Tasks

## 1. Contract

- [x] 1.1 Delta `review-verdict-integrity`: separate reason feedback (hint and alert, field invalid only for its own value) and the single armed verdict writer while the reason dialog is open.
- [x] 1.2 Validate the change with `pnpm exec openspec validate w503-40-review-reason-controls --strict`.

## 2. Web behaviour

- [x] 2.1 Keep the reason hint mounted next to feedback, mark the reason field invalid only for its own value validation and announce a rejected request in a separate alert node.
- [x] 2.2 Keep Approve and Request changes inactive while the reason dialog is open, so the dialog owns the section's armed verdict write.

## 3. Verification

- [x] 3.1 Focused Vitest for the dialog, real transport, verdict control and risk dialog; changed-file prettier/eslint; `pnpm --filter @weeklyreport/web typecheck`.
- [x] 3.2 `pnpm spec:check` passes with this change.
- [ ] 3.3 Native browser/AT behaviour and the user-reachable race; owned by the parent integration.
