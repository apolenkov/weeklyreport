# Tasks

- **CLS-T1** — Create a `RoleBadgeSkeleton` component in `@customreport/ui`
  with the same height and width as the real badge.

- **CLS-T2** — Update `apps/web/src/app/login-page.client.tsx` to render
  skeleton on initial load, swap to real badge when `currentUser.lastRole`
  is available.

- **CLS-T3** — Test: verify CLS score in Lighthouse (expect <0.1) and
  browser DevTools Layout Shift lane.
