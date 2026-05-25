# Tasks

- **GROUP-T1** — Locate the users-list tRPC procedure (likely in
  `apps/api/src/modules/users/users.router.ts`).

- **GROUP-T2** — Add a role-coverage middleware or inline check: if caller
  is a head, add WHERE clause to filter by `currentUser.groupIds`. Update
  the Prisma query.

- **GROUP-T3** — Extend `users-tab.test.tsx` with two scenarios: head sees
  only own-group users, admin sees all users.

- **GROUP-T4** — Manual verification: log in as a head, navigate to admin
  dashboard, confirm user list is filtered.
