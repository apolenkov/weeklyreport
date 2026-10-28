# Design

## Context

In `packages/ui/src/components/ui/sheet.tsx`, `SheetContent` embeds an absolute close button (`SheetPrimitive.Close`) positioned at `top-2 right-2` with size `size-11` (44px square, reaching from right: 8px to right: 52px).
`SheetHeader` default styling is `flex flex-col gap-1.5 p-4`. With `p-4` (padding-right: 16px), any header content wider than `width - 52px` extends under the close button.
In `apps/web/src/features/report-pages/ui/lead-report-assistant.tsx`, the caller worked around this locally by passing `px-5 py-5 pr-14`.
However, other callers such as `apps/web/src/shared/ui/navigation/mobile-nav.tsx` only pass `p-4` (or rely on default), which caused underlap on compact 375px screens when longer titles are rendered.

## Goals / Non-Goals

**Goals:**

- Provide built-in right clearance on `SheetHeader` (`pr-14`) so header text does not collide with the default absolute close button.
- Ensure custom classes passed to `SheetHeader` can still override padding via `tailwind-merge` (`cn`).
- Add regression unit tests verifying `SheetHeader` default classes and behavior with consumers.

**Non-Goals:**

- Modifying Radix Dialog/Sheet primitives or re-architecting `SheetContent`.
- Breaking callers that already define explicit right clearance (e.g. `pr-14`).

## Decisions

- **Decision 1: Use `p-4 pr-14` (or `p-4 pe-14` / `p-4 pr-12`) in `SheetHeader`**:
  `SheetPrimitive.Close` is `top-2 right-2 size-11`. Its left edge is `8px + 44px = 52px` from the right edge of `SheetContent`. With `pr-14` (3.5rem = 56px), header content stops at 56px from the right boundary, leaving a 4px safety gap before the 52px close button boundary.
  Using `pr-14` directly matches the existing pattern in `lead-report-assistant.tsx` (`pr-14`).
  In `packages/ui/src/components/ui/sheet.tsx`:
  ```tsx
  className={cn("flex flex-col gap-1.5 p-4 pr-14", className)}
  ```
  `twMerge` correctly handles overrides when a caller passes another `pr-*` or `p-*`.

## Risks / Trade-offs

- [Risk: callers passing `p-4` without explicit `pr` might lose clearance if `twMerge` treats `p-4` as overriding `pr-14`]:
  In Tailwind merge (`twMerge` v3), `p-4` after `pr-14` would override right padding. In `mobile-nav.tsx`:
  `<SheetHeader className="border-b border-[var(--color-border)] p-4">`
  If `p-4` is passed in `className`, `cn("... p-4 pr-14", "border-b border-[var(--color-border)] p-4")` would result in `p-4` winning over `pr-14`!
  → **Mitigation**:
  1. Either `SheetHeader` applies `p-4 pr-14`, and in `mobile-nav.tsx` remove redundant `p-4` from `className` (since `SheetHeader` already has `p-4`), or keep `SheetHeader` base padding `p-4 pr-14` and adjust `mobile-nav.tsx` to not clobber `pr-14` with a redundant `p-4` override.
  2. Verify with unit test how `cn("flex flex-col gap-1.5 p-4 pr-14", className)` behaves when `className` is empty vs when `className="border-b border-[var(--color-border)] p-4"`. In `mobile-nav.tsx:39`, `SheetHeader` has `className="border-b border-[var(--color-border)] p-4"`. If `mobile-nav` passes `p-4`, `twMerge` will collapse `pr-14` into `p-4`!
     Therefore, clean up redundant `p-4` in `mobile-nav.tsx` or let `mobile-nav.tsx` use `border-b border-[var(--color-border)]` (relying on `SheetHeader`'s default `p-4 pr-14`).
