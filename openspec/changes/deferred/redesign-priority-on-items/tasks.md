# Tasks

- [ ] T1: Design phase — design.md with schema changes (Item.priority added,
      Priority section deprecated), before/after data flow, and rollout strategy
- [ ] T2: Update Prisma schema — add priority enum or integer field to Item
      model; plan migration strategy for existing records
- [ ] T3: Update Zod schemas — add priority field to item validation in
      `packages/shared/src/schemas/item.schema.ts`
- [ ] T4: Add per-item priority UI — add priority selector to item-row
      component; hide the standalone Priority section
- [ ] T5: Update mutations — ensure item upsert/create mutations persist
      priority; test with both lead and head roles
- [ ] T6: Deprecate Priority section — remove or mark Priority section as
      coming soon (ComingSoonBadge)
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass;
      manual item-level priority selection test
