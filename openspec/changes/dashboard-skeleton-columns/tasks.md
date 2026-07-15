## 1. Replace the dynamic Tailwind width class with a JIT-extractable form

- [x] 1.1 `apps/web/src/features/dashboard/ui/dashboard-skeleton.tsx`:
      locate the `` `h-3 w-[${w}px]` `` template literal
- [x] 1.2 Confirm whether the width values (`w`) come from a small closed
      set or an arbitrary computed number
- [x] 1.3a If a small closed set: replace with a static lookup map from
      width value to literal class string (each entry written out in full,
      e.g. `120: "w-[120px]"`, so the JIT scanner sees the literal string)
- [ ] 1.3b If arbitrary/computed: replace with `style={{ width: w }}`
      instead of a Tailwind class
- [x] 1.4 Grep the same file (and neighboring skeleton components, if any)
      for other dynamic Tailwind template-literal classes; note any found
      as a follow-up, do not silently expand this change to fix them

## 2. Tests

- [x] 2.1 `dashboard-skeleton.test.tsx`: assert each bar's rendered
      className (or `style.width`) reflects a non-empty, non-zero width
      value matching the intended width
- [x] 2.2 Review the existing `__snapshots__/dashboard-skeleton.test.tsx.snap`
      diff after the source change; refresh with `vitest -u` only after
      confirming the diff is exactly the width-expression change and
      nothing else regressed

## 3. Spec delta

- [x] 3.1 `web-polish-lows`: ADD a requirement that skeleton bar widths use
      a JIT-extractable Tailwind class or inline style, never a dynamic
      template-literal class string

## 4. Gates and verification

- [ ] 4.1 `pnpm --filter @customreport/api db:generate`
- [ ] 4.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 4.3 Run the app from source (not the stale docker image), load the
      head dashboard loading state, confirm skeleton bars render with
      visible non-zero width
- [ ] 4.4 `openspec validate dashboard-skeleton-columns --strict`
