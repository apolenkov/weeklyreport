# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Fix the nested button

- [x] In `apps/web/src/components/admin/settings-tab.tsx`, change the inner
      `<button>` inside `HolidaysComingSoonControl` to a `<span>` (non-interactive),
      preserving `aria-label="Holidays calendar is coming soon"`, `title`,
      `data-testid="holidays-coming-soon"`, the `Calendar` icon, and the visual
      classes. The enclosing `TabsTrigger` remains the only `<button>`.
- [x] Keep the `ComingSoonBadge` tooltip and `group-hover`/`group-focus-within`
      behavior working (focus-within still applies via the TabsTrigger button).
- [x] Repoint or remove the dangling `TODO(holidays-activation)` reference to
      `.planning/todos/pending/2026-05-21-holidays-calendar.md` (`.planning/`
      was removed).

## Verify

- [ ] `pnpm test` green (admin settings tests still pass; `holidays-coming-soon`
      testid still resolves).
- [ ] Manual/Playwright re-sweep of `/admin?tab=settings` under the admin role:
      0 console errors (was 2).
