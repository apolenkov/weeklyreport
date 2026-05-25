# Tasks

- [x] **CLS-T1** — Create a skeleton placeholder for the role-badge area.
      Already done inline in `apps/web/src/app/login-page.client.tsx` as part of
      UFB-071: `data-testid="last-role-hint-skeleton"` renders two `<Skeleton>`
      lines with `min-h-[63px]` while `lastRoleLoaded === false`. No separate
      `@customreport/ui` component needed — inline is simpler and sufficient.

- [x] **CLS-T2** — Update `login-page.client.tsx` to use skeleton on load.
      Already done: `lastRoleLoaded` starts as `!AUTH_STUB`; in dev mode renders
      the skeleton until `useEffect` reads localStorage. Container uses
      `max-height + opacity + margin-top` CSS transitions so the reveal is
      animated, not a jarring shift.

- [ ] **CLS-T3** — Manual verification: open the landing page in Chrome
      DevTools → Performance tab, confirm no layout shift in the Layout Shift
      lane during the auth hydration window. Lighthouse CLS should remain < 0.1.
