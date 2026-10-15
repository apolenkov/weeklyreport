# Tasks

- [x] 1. Spec delta for `review-acknowledge-placement`.
- [x] 2. RED: repository keeps the receipt on repeat (unit + DB integration);
      control inert while the roster loads (web).
- [x] 3. Upsert `update: {}`; drop `@updatedAt` from `seenAt` (no DDL change);
      control disabled until the roster query succeeds and until the
      post-acknowledge refetch settles.
- [ ] 4. Six repository gates on the reviewed tree; independent review.
