# Deferred Items — Phase 15 Plan 01

Items discovered during execution that are out of scope for this plan.

## Pre-existing Test Failures (10 failures)

Discovered during Task 1 (Vitest React plugin fix). These failures pre-date Phase 15 and are caused by component-test mismatches from earlier development. They are NOT regressions from 15-01 changes.

### 1. role-nav.test.tsx (3 failures)
- **File**: `apps/web/src/components/navigation/role-nav.test.tsx`
- **Cause**: Tests render `RoleNav` without wrapping in `SidebarProvider` context, which became required after the Phase 15-02 nav restructure that moved components into a shadcn/ui Sidebar.
- **Fix needed**: Wrap test renders in `<SidebarProvider>` (or mock the sidebar context).

### 2. report-submit.spec.tsx (3 failures)
- **File**: `apps/web/src/components/report-section/report-submit.spec.tsx`
- **Cause**: Tests look for button text `'Submit section'` (lowercase 's') but the component renders `'Submit Section'` (uppercase 'S') — capitalization mismatch.
- **Fix needed**: Either fix the test query (`/submit section/i`) or align button text casing with the test.

### 3. report-section-form.test.tsx (2 failures)
- **File**: `apps/web/src/components/report-section/report-section-form.test.tsx`
- **Cause 1**: `toBeDisabled()` on a radiogroup/div element — these ARIA roles don't reflect `disabled` as an HTML attribute accessible by `toBeDisabled()`.
- **Cause 2**: `screen.getByText('Carried over from previous report')` — the text in the DOM is displayed as a badge `'Carried Over'`, not the full sentence.
- **Fix needed**: Update assertions to match actual DOM output.

### 4. assembled-report-review.test.tsx (1 failure)
- **File**: `apps/web/src/components/head/assembled-report-review.test.tsx`
- **Cause**: `screen.getByText('Report published')` — this text is shown via `toast.success()` which renders outside the test DOM (in the Sonner toast portal).
- **Fix needed**: Mock `toast.success` and assert on the mock, or use a different verification approach.

### 5. admin-panel.test.tsx (1 failure)
- **File**: `apps/web/src/components/admin/admin-panel.test.tsx`
- **Cause**: `screen.getByText('Carry-over completed')` — also in a `toast.success()` call, not the DOM.
- **Fix needed**: Same as #4 — mock the toast or check via mock assertion.

## Pre-existing TypeScript Errors

Multiple `lucide-react` and `next/navigation` "cannot find module" errors exist in the TypeScript build for web pages. These are pre-existing and caused by the shared tsconfig including API source files which lack those dependencies. Out of scope for 15-01.
