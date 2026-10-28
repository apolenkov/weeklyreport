# Tasks

## 1. Regression Test (RED)

- [x] 1.1 Add regression test verifying SheetHeader default trailing clearance (`pr-14`) and mobile-nav clearance against close button under `apps/web/src/shared/ui/style/sheet-clearance.test.tsx` (verify RED prior to fix).

## 2. Implementation

- [x] 2.1 Update SheetHeader in `packages/ui/src/components/ui/sheet.tsx` with default right padding clearance (`pr-14`).
- [x] 2.2 Update `apps/web/src/shared/ui/navigation/mobile-nav.tsx` SheetHeader className so it does not override `pr-14` with a redundant `p-4`.
- [x] 2.3 Verify tests pass (GREEN).

## 3. Verification

- [x] 3.1 Run OpenSpec validation `pnpm exec openspec validate w503-81-fix --strict`.
- [ ] 3.2 Run the six required quality gates via `run-checks`.
