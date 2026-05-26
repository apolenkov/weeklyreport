# Tasks

- [ ] T1: Create Prisma migration — add `jiraIssueKey VARCHAR(20)` to Item
      model (nullable, unique constraint optional)
- [ ] T2: Update Prisma schema — add `jiraIssueKey` field to Item entity
- [ ] T3: Update `ItemEditDialog.tsx` — add text input for Jira key; validate
      format (e.g., PROJ-1234)
- [ ] T4: Update `Item` tRPC schema (Zod) to include optional `jiraIssueKey`
- [ ] T5: Update item-detail display in slides and head-role views — render
      Jira key as a link (e.g., `https://jira.example.com/browse/PROJ-1234`)
- [ ] T6: Add test cases for Jira key input validation and link rendering
- [ ] T7: Commit — `feat(items): add optional Jira issue linking`
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass;
      manual test adding a Jira key to an item
