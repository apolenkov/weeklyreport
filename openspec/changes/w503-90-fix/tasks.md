# Tasks

## 1. Test Preparation (RED)

- [x] 1.1 Add unit tests in `apps/web/src/features/report-pages/ui/product/accordion-header.test.tsx` verifying that `AccordionHeader` button contains zero `div` descendants and correctly presents name, role, status, and click events.
- [x] 1.2 Run test to verify RED state (failure due to existing `div` elements inside `<button>`).

## 2. Implementation (GREEN)

- [x] 2.1 Replace `div` tags with `span` tags in `HeaderIdentity` within `apps/web/src/features/report-pages/ui/product/accordion-header.tsx`.
- [x] 2.2 Run test to verify GREEN state.

## 3. Verification & Checks

- [x] 3.1 Validate OpenSpec change `w503-90-fix` with `openspec validate w503-90-fix --strict`.
- [ ] 3.2 Run the 6 repository gates via `run-checks`.
- [ ] 3.3 Commit changes with Conventional Commit and TASK-503.90 footer.
